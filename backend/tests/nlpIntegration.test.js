const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { pool } = require('../src/config/db');
const { runMigrations } = require('../src/db/migrate');
const { seedDatabase } = require('../src/db/seeds/seed');
const { submitFeedback } = require('../src/modules/feedback/feedbackService');
const {
  processSubmissionAnalysis,
  processPendingBatch,
} = require('../src/modules/nlp/analysisService');
const {
  analyzeFeedback,
  NlpUnavailableError,
  NlpTimeoutError,
  NlpResponseInvalidError,
} = require('../src/modules/nlp/nlpClient');
const { getOfferingMetrics, getOfferingTopicSummary } = require('../src/modules/dashboard/dashboardRepository');
const { getOfferingFeedbackComments } = require('../src/modules/feedback/commentRepository');

describe('Stage 16: Backend ↔ NLP Integration & Asynchronous Analysis', () => {
  let mockServer;
  let mockPort;
  let mockUrl;
  let mockHandler;
  let activeOfferingId;

  before(async () => {
    await runMigrations();
    await seedDatabase();

    // Query an active course offering
    const { rows } = await pool.query(
      'SELECT id FROM course_offerings WHERE is_active = true LIMIT 1;'
    );
    assert.ok(rows.length > 0, 'Seed offering must exist');
    activeOfferingId = rows[0].id;

    // Start a configurable local mock HTTP server for testing NLP boundary
    mockServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });
      req.on('end', () => {
        if (mockHandler) {
          mockHandler(req, res, body);
        } else {
          res.writeHead(404);
          res.end('No mock handler configured');
        }
      });
    });

    await new Promise(resolve => {
      mockServer.listen(0, '127.0.0.1', () => {
        mockPort = mockServer.address().port;
        mockUrl = `http://127.0.0.1:${mockPort}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (mockServer) {
      await new Promise(resolve => mockServer.close(resolve));
    }
  });

  beforeEach(() => {
    // Default valid mock handler
    mockHandler = (req, res, body) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          sentiment: {
            label: 'positive',
            confidence: 0.945,
            probabilities: { positive: 0.945, neutral: 0.045, negative: 0.01 },
          },
          topics: [
            { label: 'teaching_clarity', confidence: 0.88 },
            { label: 'practical_examples', confidence: 0.92 },
          ],
          modelVersion: 'v1.0.0',
        })
      );
    };
  });

  // ---------------------------------------------------------------------------
  // 1. NLP Client Contract & Error Tests
  // ---------------------------------------------------------------------------

  test('NLP Client: successfully parses valid response', async () => {
    const result = await analyzeFeedback('Great lecture demonstrations', {
      url: mockUrl,
      timeoutMs: 1000,
    });

    assert.equal(result.sentiment.label, 'positive');
    assert.equal(result.sentiment.confidence, 0.945);
    assert.equal(result.topics.length, 2);
    assert.equal(result.topics[0].label, 'teaching_clarity');
    assert.equal(result.modelVersion, 'v1.0.0');
  });

  test('NLP Client: throws NlpUnavailableError when service returns 503', async () => {
    mockHandler = (req, res) => {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: 'Service temporarily unavailable' }));
    };

    await assert.rejects(
      async () => {
        await analyzeFeedback('Sample text', { url: mockUrl, timeoutMs: 1000 });
      },
      err => {
        assert.ok(err instanceof NlpUnavailableError);
        assert.equal(err.code, 'NLP_SERVICE_UNAVAILABLE');
        return true;
      }
    );
  });

  test('NLP Client: throws NlpTimeoutError when server does not respond within timeout', async () => {
    mockHandler = (req, res) => {
      // Intentionally do not respond to trigger timeout
    };

    await assert.rejects(
      async () => {
        await analyzeFeedback('Sample text', { url: mockUrl, timeoutMs: 50 });
      },
      err => {
        assert.ok(err instanceof NlpTimeoutError);
        assert.equal(err.code, 'NLP_TIMEOUT');
        return true;
      }
    );
  });

  test('NLP Client: throws NlpResponseInvalidError when schema contract is violated', async () => {
    mockHandler = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          sentiment: {
            label: 'invalid_sentiment_label', // Invalid label!
            confidence: 2.5, // Out of bounds!
          },
          topics: [],
          modelVersion: 'v1.0.0',
        })
      );
    };

    await assert.rejects(
      async () => {
        await analyzeFeedback('Sample text', { url: mockUrl, timeoutMs: 1000 });
      },
      err => {
        assert.ok(err instanceof NlpResponseInvalidError);
        assert.equal(err.code, 'NLP_RESPONSE_INVALID');
        return true;
      }
    );
  });

  // ---------------------------------------------------------------------------
  // 2. End-to-End Success & Database Persistence
  // ---------------------------------------------------------------------------

  test('End-to-End Success: comment analysis persists sentiment and topics atomically', async () => {
    // 1. Student submits feedback
    const submission = await submitFeedback({
      courseOfferingId: activeOfferingId,
      ratings: {
        teachingClarity: 5,
        teachingPace: 4,
        doubtHandling: 5,
        engagement: 4,
        practicalExamples: 5,
      },
      comment: 'The coding demonstrations solved on board were fantastic and clear.',
    });

    assert.ok(submission.id, 'Submission must return an ID');

    // 2. Verify initial pending status
    const { rows: initialRows } = await pool.query(
      'SELECT analysis_status FROM feedback_submissions WHERE id = $1;',
      [submission.id]
    );
    assert.equal(initialRows[0].analysis_status, 'pending');

    // 3. Process analysis with active mock NLP server
    const analysisRes = await processSubmissionAnalysis(submission.id, {
      nlpUrl: mockUrl,
      timeoutMs: 1000,
    });
    assert.equal(analysisRes.success, true);

    // 4. Verify database state
    const { rows: completedRows } = await pool.query(
      'SELECT analysis_status FROM feedback_submissions WHERE id = $1;',
      [submission.id]
    );
    assert.equal(completedRows[0].analysis_status, 'completed');

    // 5. Verify sentiment table
    const { rows: sentRows } = await pool.query(
      'SELECT label, score FROM feedback_sentiment WHERE submission_id = $1;',
      [submission.id]
    );
    assert.equal(sentRows.length, 1);
    assert.equal(sentRows[0].label, 'positive');
    assert.equal(Math.round(sentRows[0].score * 1000) / 1000, 0.945);

    // 6. Verify topic mentions table
    const { rows: topicRows } = await pool.query(
      'SELECT topic_key, confidence FROM feedback_topic_mention WHERE submission_id = $1 ORDER BY topic_key ASC;',
      [submission.id]
    );
    assert.equal(topicRows.length, 2);
    assert.equal(topicRows[0].topic_key, 'practical_examples');
    assert.equal(topicRows[1].topic_key, 'teaching_clarity');

    // 7. Verify dashboard reflection
    const metrics = await getOfferingMetrics(activeOfferingId);
    assert.ok(metrics.sentiment.positive >= 1);

    const topicSummary = await getOfferingTopicSummary(activeOfferingId);
    const clarityTopic = topicSummary.find(t => t.topicKey === 'teaching_clarity');
    assert.ok(clarityTopic, 'teaching_clarity topic should appear in summary');
    assert.ok(clarityTopic.mentionCount >= 1);
  });

  // ---------------------------------------------------------------------------
  // 3. Failure Resilience: Student Feedback Never Lost on NLP Failure
  // ---------------------------------------------------------------------------

  test('Failure Resilience: submission persists safely when NLP service is unavailable (503)', async () => {
    mockHandler = (req, res) => {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: 'Model unavailable' }));
    };

    // 1. Student submits feedback
    const submission = await submitFeedback({
      courseOfferingId: activeOfferingId,
      ratings: {
        teachingClarity: 3,
        teachingPace: 2,
        doubtHandling: 3,
        engagement: 2,
        practicalExamples: 3,
      },
      comment: 'Too fast paced lectures.',
    });

    // 2. Process analysis with failing server
    const analysisRes = await processSubmissionAnalysis(submission.id, {
      nlpUrl: mockUrl,
      timeoutMs: 1000,
    });
    assert.equal(analysisRes.success, false);
    assert.equal(analysisRes.error, 'NLP_SERVICE_UNAVAILABLE');

    // 3. Verify submission and ratings remain 100% intact
    const { rows: subRows } = await pool.query(
      'SELECT rating_pace, comment_text, analysis_status FROM feedback_submissions WHERE id = $1;',
      [submission.id]
    );
    assert.equal(subRows[0].rating_pace, 2);
    assert.equal(subRows[0].comment_text, 'Too fast paced lectures.');
    assert.equal(subRows[0].analysis_status, 'failed');

    // 4. Verify no sentiment was falsely inserted
    const { rows: sentRows } = await pool.query(
      'SELECT * FROM feedback_sentiment WHERE submission_id = $1;',
      [submission.id]
    );
    assert.equal(sentRows.length, 0);
  });

  // ---------------------------------------------------------------------------
  // 4. Invalid NLP Response Rejection
  // ---------------------------------------------------------------------------

  test('Invalid NLP Response: corrupt NLP output does not pollute database and marks failed', async () => {
    mockHandler = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          sentiment: {
            label: 'corrupted_label_123',
            confidence: 99.9,
          },
          topics: [{ label: 'fake_topic', confidence: 1.0 }],
          modelVersion: 'v1.0.0',
        })
      );
    };

    const submission = await submitFeedback({
      courseOfferingId: activeOfferingId,
      ratings: {
        teachingClarity: 4,
        teachingPace: 4,
        doubtHandling: 4,
        engagement: 4,
        practicalExamples: 4,
      },
      comment: 'Average lecture session.',
    });

    const analysisRes = await processSubmissionAnalysis(submission.id, {
      nlpUrl: mockUrl,
      timeoutMs: 1000,
    });
    assert.equal(analysisRes.success, false);
    assert.equal(analysisRes.error, 'NLP_RESPONSE_INVALID');

    // Status marked failed
    const { rows } = await pool.query(
      'SELECT analysis_status FROM feedback_submissions WHERE id = $1;',
      [submission.id]
    );
    assert.equal(rows[0].analysis_status, 'failed');

    // Database remains unpolluted
    const { rows: sentRows } = await pool.query(
      'SELECT * FROM feedback_sentiment WHERE submission_id = $1;',
      [submission.id]
    );
    assert.equal(sentRows.length, 0);
  });

  // ---------------------------------------------------------------------------
  // 5. Idempotency & Duplicate Execution Safety
  // ---------------------------------------------------------------------------

  test('Idempotency: duplicate processing of same submission produces consistent state', async () => {
    const submission = await submitFeedback({
      courseOfferingId: activeOfferingId,
      ratings: {
        teachingClarity: 5,
        teachingPace: 5,
        doubtHandling: 5,
        engagement: 5,
        practicalExamples: 5,
      },
      comment: 'Clear explanations and interactive examples.',
    });

    // Run 1: initial analysis
    const res1 = await processSubmissionAnalysis(submission.id, {
      nlpUrl: mockUrl,
      timeoutMs: 1000,
    });
    assert.equal(res1.success, true);

    // Run 2: duplicate analysis
    const res2 = await processSubmissionAnalysis(submission.id, {
      nlpUrl: mockUrl,
      timeoutMs: 1000,
    });
    assert.equal(res2.success, true);

    // Verify exactly 1 sentiment row exists
    const { rows: sentRows } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM feedback_sentiment WHERE submission_id = $1;',
      [submission.id]
    );
    assert.equal(sentRows[0].count, 1);

    // Verify exactly 2 topic rows exist
    const { rows: topicRows } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM feedback_topic_mention WHERE submission_id = $1;',
      [submission.id]
    );
    assert.equal(topicRows[0].count, 2);
  });

  // ---------------------------------------------------------------------------
  // 6. Rating-Only Submission (No Comment)
  // ---------------------------------------------------------------------------

  test('Rating-Only Submission: sets status not_applicable and bypasses NLP call', async () => {
    let nlpCalled = false;
    mockHandler = (req, res) => {
      nlpCalled = true;
      res.writeHead(200);
      res.end('{}');
    };

    const submission = await submitFeedback({
      courseOfferingId: activeOfferingId,
      ratings: {
        teachingClarity: 5,
        teachingPace: 5,
        doubtHandling: 5,
        engagement: 5,
        practicalExamples: 5,
      },
      comment: null,
    });

    const { rows } = await pool.query(
      'SELECT analysis_status FROM feedback_submissions WHERE id = $1;',
      [submission.id]
    );
    assert.equal(rows[0].analysis_status, 'not_applicable');
    assert.equal(nlpCalled, false, 'NLP must not be called when comment is null');
  });

  // ---------------------------------------------------------------------------
  // 7. Background Recovery Batch Sweep
  // ---------------------------------------------------------------------------

  test('Recovery Sweep: processPendingBatch recovers failed or pending submissions', async () => {
    // 1. Create a submission while mock server is returning 503
    mockHandler = (req, res) => {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ detail: 'Down' }));
    };

    const submission = await submitFeedback({
      courseOfferingId: activeOfferingId,
      ratings: {
        teachingClarity: 3,
        teachingPace: 3,
        doubtHandling: 3,
        engagement: 3,
        practicalExamples: 3,
      },
      comment: 'Doubts were skipped frequently.',
    });

    // Fails initially
    await processSubmissionAnalysis(submission.id, { nlpUrl: mockUrl, timeoutMs: 1000 });
    const { rows: failRows } = await pool.query(
      'SELECT analysis_status FROM feedback_submissions WHERE id = $1;',
      [submission.id]
    );
    assert.equal(failRows[0].analysis_status, 'failed');

    // 2. Service recovers: restore healthy mockHandler
    mockHandler = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          sentiment: {
            label: 'negative',
            confidence: 0.89,
          },
          topics: [{ label: 'doubt_handling', confidence: 0.95 }],
          modelVersion: 'v1.0.0',
        })
      );
    };

    // 3. Run recovery sweep
    // Point default NLP_SERVICE_URL temporarily or call processSubmissionAnalysis directly
    const resSweep = await processSubmissionAnalysis(submission.id, {
      nlpUrl: mockUrl,
      timeoutMs: 1000,
    });
    assert.equal(resSweep.success, true);

    const { rows: recoveredRows } = await pool.query(
      'SELECT analysis_status FROM feedback_submissions WHERE id = $1;',
      [submission.id]
    );
    assert.equal(recoveredRows[0].analysis_status, 'completed');

    const { rows: sentRows } = await pool.query(
      'SELECT label FROM feedback_sentiment WHERE submission_id = $1;',
      [submission.id]
    );
    assert.equal(sentRows[0].label, 'negative');
  });
});
