const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const { pool, query, closePool } = require('../src/config/db');
const { runMigrations } = require('../src/db/migrate');
const { seedDatabase } = require('../src/db/seeds/seed');
const { processPendingBatch } = require('../src/modules/nlp/analysisService');

// Helper to make HTTP requests against the Express app
async function request(handler, options = {}) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const url = `http://127.0.0.1:${port}${options.path || '/'}`;
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, body: json, headers: res.headers };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test.describe('Stage 20: Full-System Integration & End-to-End Verification', () => {
  let mockNlpServer;
  let mockNlpPort;
  let originalNlpUrl;
  let mockNlpHandler;

  let profSharma;
  let profDesai;
  let sharmaToken;
  let desaiToken;

  let cs301OfferingId; // Owned by Sharma, N >= 5
  let cs201OfferingId; // Owned by Desai, N = 2 (< 5)
  let cs405OfferingId; // Owned by Sharma, N = 0

  test.before(async () => {
    // 1. Run migrations and fresh seed
    await runMigrations();
    await seedDatabase();

    // 2. Set up configurable mock NLP server on loopback
    originalNlpUrl = env.NLP_SERVICE_URL;
    mockNlpServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        if (mockNlpHandler) {
          mockNlpHandler(req, res, body);
        } else {
          // Default valid NLP response matching Stage 15/16 contract
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            sentiment: {
              label: 'positive',
              confidence: 0.95,
              probabilities: { positive: 0.95, neutral: 0.04, negative: 0.01 },
            },
            topics: [
              { label: 'teaching_clarity', confidence: 0.92 },
              { label: 'practical_examples', confidence: 0.88 },
            ],
            modelVersion: 'v1.0.0',
          }));
        }
      });
    });

    await new Promise((resolve) => {
      mockNlpServer.listen(0, '127.0.0.1', () => {
        mockNlpPort = mockNlpServer.address().port;
        env.NLP_SERVICE_URL = `http://127.0.0.1:${mockNlpPort}`;
        resolve();
      });
    });

    // 3. Retrieve professors
    const { rows: profs } = await query('SELECT id, email, full_name FROM professors ORDER BY email;');
    profDesai = profs.find(p => p.email === 'desai@university.edu');
    profSharma = profs.find(p => p.email === 'sharma@university.edu');

    // 4. Retrieve course offerings
    const { rows: offerings } = await query(`
      SELECT o.id, c.code, o.professor_id
      FROM course_offerings o
      JOIN courses c ON c.id = o.course_id
      WHERE o.term = 'Fall 2026';
    `);

    cs301OfferingId = offerings.find(o => o.code === 'CS301').id;
    cs201OfferingId = offerings.find(o => o.code === 'CS201').id;
    cs405OfferingId = offerings.find(o => o.code === 'CS405').id;

    // 5. Generate authenticated tokens
    sharmaToken = jwt.sign(
      { professorId: profSharma.id, email: profSharma.email },
      env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    desaiToken = jwt.sign(
      { professorId: profDesai.id, email: profDesai.email },
      env.JWT_SECRET,
      { expiresIn: '24h' }
    );
  });

  test.after(async () => {
    // Restore environment URL
    env.NLP_SERVICE_URL = originalNlpUrl;
    if (mockNlpServer) {
      await new Promise(resolve => mockNlpServer.close(resolve));
    }
    await new Promise(resolve => setTimeout(resolve, 50));
    await closePool();
  });

  // ---------------------------------------------------------------------------
  // Flow 1: Student Feedback Submission -> Async NLP -> Database Persistence
  // ---------------------------------------------------------------------------
  test('E2E Flow 1: Student submits feedback with comment, triggers async NLP, persists sentiment & topics', async () => {
    // Student submits valid feedback
    const res = await request(app, {
      method: 'POST',
      path: '/api/v1/feedback',
      body: {
        courseOfferingId: cs301OfferingId,
        ratings: {
          teachingClarity: 5,
          teachingPace: 4,
          doubtHandling: 5,
          engagement: 5,
          practicalExamples: 4,
        },
        comment: 'Brilliant deep dive into indexing and query optimization!',
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'Feedback submitted successfully.');
    // Must NOT leak internal submission UUID to anonymous student
    assert.equal(res.body.id, undefined);
    assert.equal(res.body.submissionId, undefined);

    // Allow asynchronous setImmediate worker to process NLP analysis
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify submission status in database
    const { rows: afterRows } = await query(
      'SELECT id, analysis_status, comment_text FROM feedback_submissions WHERE offering_id = $1 ORDER BY created_at DESC LIMIT 1;',
      [cs301OfferingId]
    );
    assert.equal(afterRows.length, 1);
    const latestSubmission = afterRows[0];
    assert.equal(latestSubmission.analysis_status, 'completed');
    assert.equal(latestSubmission.comment_text, 'Brilliant deep dive into indexing and query optimization!');

    // Verify sentiment was persisted atomically
    const { rows: sentimentRows } = await query(
      'SELECT label, score FROM feedback_sentiment WHERE submission_id = $1;',
      [latestSubmission.id]
    );
    assert.equal(sentimentRows.length, 1);
    assert.equal(sentimentRows[0].label, 'positive');
    assert.ok(sentimentRows[0].score >= 0.9);

    // Verify topic mentions were persisted
    const { rows: topicRows } = await query(
      'SELECT topic_key, confidence FROM feedback_topic_mention WHERE submission_id = $1 ORDER BY topic_key;',
      [latestSubmission.id]
    );
    assert.equal(topicRows.length, 2);
    assert.equal(topicRows[0].topic_key, 'practical_examples');
    assert.equal(topicRows[1].topic_key, 'teaching_clarity');
  });

  // ---------------------------------------------------------------------------
  // Flow 2: Student Feedback Submission (Rating-Only) -> Bypasses NLP
  // ---------------------------------------------------------------------------
  test('E2E Flow 2: Rating-only feedback bypasses NLP call and marks status not_applicable', async () => {
    let nlpCalled = false;
    mockNlpHandler = (req, res) => {
      nlpCalled = true;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    };

    const res = await request(app, {
      method: 'POST',
      path: '/api/v1/feedback',
      body: {
        courseOfferingId: cs301OfferingId,
        ratings: {
          teachingClarity: 4,
          teachingPace: 3,
          doubtHandling: 4,
          engagement: 3,
          practicalExamples: 4,
        },
      },
    });

    assert.equal(res.status, 201);
    await new Promise(resolve => setTimeout(resolve, 50));

    // NLP should NOT have been called
    assert.equal(nlpCalled, false);

    // Verify status in DB
    const { rows } = await query(
      'SELECT analysis_status, comment_text FROM feedback_submissions WHERE offering_id = $1 ORDER BY created_at DESC LIMIT 1;',
      [cs301OfferingId]
    );
    assert.equal(rows[0].analysis_status, 'not_applicable');
    assert.equal(rows[0].comment_text, null);

    // Reset handler
    mockNlpHandler = null;
  });

  // ---------------------------------------------------------------------------
  // Flow 3: Privacy & Anonymity Audit
  // ---------------------------------------------------------------------------
  test('E2E Flow 3: Complete privacy boundary audit (no student identifiers anywhere)', async () => {
    // 1. Database table schema check: feedback_submissions has no student foreign key or identifiers
    const { rows: cols } = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'feedback_submissions';
    `);
    const colNames = cols.map(c => c.column_name);
    assert.ok(!colNames.includes('student_id'));
    assert.ok(!colNames.includes('user_id'));
    assert.ok(!colNames.includes('email'));
    assert.ok(!colNames.includes('name'));
    assert.ok(!colNames.includes('ip_address'));
    assert.ok(!colNames.includes('user_agent'));

    // 2. Reject injection of unknown student identity fields in submission payload
    const res = await request(app, {
      method: 'POST',
      path: '/api/v1/feedback',
      body: {
        courseOfferingId: cs301OfferingId,
        studentId: 'STU123456',
        ratings: {
          teachingClarity: 5,
          teachingPace: 5,
          doubtHandling: 5,
          engagement: 5,
          practicalExamples: 5,
        },
      },
    });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  // ---------------------------------------------------------------------------
  // Flow 4: Professor Authentication & Authorized Offerings
  // ---------------------------------------------------------------------------
  test('E2E Flow 4: Professor signs in and receives only their authorized course offerings', async () => {
    // Login with valid credentials
    const loginRes = await request(app, {
      method: 'POST',
      path: '/api/v1/auth/login',
      body: {
        email: 'sharma@university.edu',
        password: 'SecurePassword123!',
      },
    });

    assert.equal(loginRes.status, 200);
    assert.ok(loginRes.body.token);
    assert.equal(loginRes.body.professor.fullName, 'Dr. Ramesh Sharma');
    assert.equal(loginRes.body.professor.email, 'sharma@university.edu');
    assert.equal(loginRes.body.professor.password_hash, undefined);

    const token = loginRes.body.token;

    // Fetch authorized offerings
    const offRes = await request(app, {
      path: '/api/v1/professor/offerings',
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(offRes.status, 200);
    assert.ok(Array.isArray(offRes.body));
    // Sharma teaches CS301 and CS405
    const codes = offRes.body.map(o => o.courseCode);
    assert.ok(codes.includes('CS301'));
    assert.ok(codes.includes('CS405'));
    // Must NOT contain Desai's course CS201
    assert.ok(!codes.includes('CS201'));
  });

  // ---------------------------------------------------------------------------
  // Flow 5: Dashboard Analytics Contract Verification (Level 1, Level 2, Level 3)
  // ---------------------------------------------------------------------------
  test('E2E Flow 5: Dashboard numbers match mathematical ground truth of database records', async () => {
    const res = await request(app, {
      path: `/api/v1/dashboard/${cs301OfferingId}`,
      headers: { Authorization: `Bearer ${sharmaToken}` },
    });

    assert.equal(res.status, 200);
    const d = res.body;

    // Verify Offering Context
    assert.equal(d.courseOffering.courseCode, 'CS301');
    assert.equal(d.courseOffering.courseTitle, 'Database Management Systems');
    assert.equal(d.courseOffering.term, 'Fall 2026');
    assert.equal(d.privacyThresholdMet, true);

    // Verify Level 1: Overall
    assert.ok(d.overall.responseCount >= 5);
    const { positive, neutral, negative } = d.overall.sentimentDistribution;
    assert.ok(typeof positive === 'number');
    assert.ok(typeof neutral === 'number');
    assert.ok(typeof negative === 'number');

    // Verify Level 2: Teaching Performance Ratings matches database averages
    const { rows: dbAvg } = await query(`
      SELECT 
        ROUND(AVG(rating_clarity)::numeric, 2)::float as clarity,
        ROUND(AVG(rating_pace)::numeric, 2)::float as pace,
        ROUND(AVG(rating_doubt_handling)::numeric, 2)::float as doubt,
        ROUND(AVG(rating_engagement)::numeric, 2)::float as engage,
        ROUND(AVG(rating_practical_examples)::numeric, 2)::float as examples
      FROM feedback_submissions
      WHERE offering_id = $1;
    `, [cs301OfferingId]);

    const expected = dbAvg[0];
    const perfMap = {};
    for (const p of d.performance) {
      perfMap[p.dimensionKey] = p.averageScore;
    }

    assert.equal(perfMap.teachingClarity, expected.clarity);
    assert.equal(perfMap.teachingPace, expected.pace);
    assert.equal(perfMap.doubtHandling, expected.doubt);
    assert.equal(perfMap.engagement, expected.engage);
    assert.equal(perfMap.practicalExamples, expected.examples);

    // Verify Level 3: Topics
    assert.ok(Array.isArray(d.topics));
    assert.ok(d.topics.length > 0);
    for (const t of d.topics) {
      assert.ok(typeof t.topicKey === 'string');
      assert.ok(typeof t.mentionCount === 'number');
      assert.ok(t.mentionCount > 0);
      assert.ok(t.sentimentDistribution);
    }
  });

  // ---------------------------------------------------------------------------
  // Flow 6: Evidence & Feedback Comments (Level 4)
  // ---------------------------------------------------------------------------
  test('E2E Flow 6: Qualitative comments retrieve with truncated dates and support topic/sentiment filters', async () => {
    // 1. Fetch unfiltered comments
    const resAll = await request(app, {
      path: `/api/v1/feedback/${cs301OfferingId}`,
      headers: { Authorization: `Bearer ${sharmaToken}` },
    });

    assert.equal(resAll.status, 200);
    assert.ok(resAll.body.comments.length > 0);
    for (const c of resAll.body.comments) {
      assert.ok(typeof c.id === 'string');
      assert.ok(typeof c.commentText === 'string');
      // Date must be formatted as YYYY-MM-DD (temporal privacy)
      assert.match(c.submittedDate, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(!c.submittedDate.includes('T'), 'Exact timestamp must not be leaked');
    }

    // 2. Fetch filtered by topic
    const resTopic = await request(app, {
      path: `/api/v1/feedback/${cs301OfferingId}?topic=practical_examples`,
      headers: { Authorization: `Bearer ${sharmaToken}` },
    });
    assert.equal(resTopic.status, 200);
    assert.ok(resTopic.body.comments.length > 0);
    for (const c of resTopic.body.comments) {
      assert.ok(c.topics.includes('practical_examples'));
    }

    // 3. Fetch filtered by sentiment
    const resSent = await request(app, {
      path: `/api/v1/feedback/${cs301OfferingId}?sentiment=positive`,
      headers: { Authorization: `Bearer ${sharmaToken}` },
    });
    assert.equal(resSent.status, 200);
    for (const c of resSent.body.comments) {
      assert.equal(c.sentiment, 'positive');
    }
  });

  // ---------------------------------------------------------------------------
  // Flow 7: Strict Authorization Boundaries & Cross-Professor Isolation
  // ---------------------------------------------------------------------------
  test('E2E Flow 7: Enforces strict authorization barriers between professors and unauthenticated callers', async () => {
    // 1. Prof Desai CANNOT view Prof Sharma's dashboard (CS301)
    const resDesaiDash = await request(app, {
      path: `/api/v1/dashboard/${cs301OfferingId}`,
      headers: { Authorization: `Bearer ${desaiToken}` },
    });
    assert.equal(resDesaiDash.status, 403);
    assert.equal(resDesaiDash.body.error.code, 'FORBIDDEN');

    // 2. Prof Desai CANNOT view Prof Sharma's evidence comments (CS301)
    const resDesaiComments = await request(app, {
      path: `/api/v1/feedback/${cs301OfferingId}`,
      headers: { Authorization: `Bearer ${desaiToken}` },
    });
    assert.equal(resDesaiComments.status, 403);
    assert.equal(resDesaiComments.body.error.code, 'FORBIDDEN');

    // 3. Unauthenticated request to dashboard rejected with 401
    const resAnonDash = await request(app, {
      path: `/api/v1/dashboard/${cs301OfferingId}`,
    });
    assert.equal(resAnonDash.status, 401);
    assert.equal(resAnonDash.body.error.code, 'UNAUTHORIZED');

    // 4. Unauthenticated request to feedback comments rejected with 401
    const resAnonComments = await request(app, {
      path: `/api/v1/feedback/${cs301OfferingId}`,
    });
    assert.equal(resAnonComments.status, 401);
    assert.equal(resAnonComments.body.error.code, 'UNAUTHORIZED');
  });

  // ---------------------------------------------------------------------------
  // Flow 8: Privacy Threshold Guard (N < 5) & Zero-Response Empty State (N = 0)
  // ---------------------------------------------------------------------------
  test('E2E Flow 8: Privacy threshold guard protects small cohorts; empty state handles N = 0', async () => {
    // 1. CS201 has 2 submissions (< 5 threshold). Prof Desai accesses own course.
    const resLow = await request(app, {
      path: `/api/v1/dashboard/${cs201OfferingId}`,
      headers: { Authorization: `Bearer ${desaiToken}` },
    });
    assert.equal(resLow.status, 200);
    assert.equal(resLow.body.privacyThresholdMet, false);
    assert.equal(resLow.body.overall.responseCount, 2);
    // Performance ratings and topics must be empty arrays
    assert.deepEqual(resLow.body.performance, []);
    assert.deepEqual(resLow.body.topics, []);

    // 2. CS405 has 0 submissions. Prof Sharma accesses own course.
    const resZero = await request(app, {
      path: `/api/v1/dashboard/${cs405OfferingId}`,
      headers: { Authorization: `Bearer ${sharmaToken}` },
    });
    assert.equal(resZero.status, 200);
    assert.equal(resZero.body.privacyThresholdMet, false);
    assert.equal(resZero.body.overall.responseCount, 0);
    assert.deepEqual(resZero.body.performance, []);
    assert.deepEqual(resZero.body.topics, []);
  });

  // ---------------------------------------------------------------------------
  // Flow 9: Failure Resilience & Recovery Sweeper
  // ---------------------------------------------------------------------------
  test('E2E Flow 9: NLP outage marks submission failed without student disruption; recovery sweeper processes on restore', async () => {
    // Configure mock NLP server to simulate 503 outage
    mockNlpHandler = (req, res) => {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Service Unavailable' }));
    };

    // Student submits feedback during NLP outage
    const res = await request(app, {
      method: 'POST',
      path: '/api/v1/feedback',
      body: {
        courseOfferingId: cs301OfferingId,
        ratings: {
          teachingClarity: 3,
          teachingPace: 3,
          doubtHandling: 3,
          engagement: 3,
          practicalExamples: 3,
        },
        comment: 'Temporary outage comment for resiliency test.',
      },
    });

    // Student receives immediate 201 Created confirmation
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);

    // Wait for async handler to attempt NLP and fail gracefully
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify submission status in database transitioned to 'failed'
    const { rows: failedRows } = await query(
      "SELECT id, analysis_status FROM feedback_submissions WHERE comment_text = 'Temporary outage comment for resiliency test.';"
    );
    assert.equal(failedRows.length, 1);
    const failedSubmission = failedRows[0];
    assert.equal(failedSubmission.analysis_status, 'failed');

    // Restore NLP service to healthy state
    mockNlpHandler = (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        sentiment: {
          label: 'neutral',
          confidence: 0.91,
          probabilities: { positive: 0.05, neutral: 0.91, negative: 0.04 },
        },
        topics: [
          { label: 'course_content', confidence: 0.85 },
        ],
        modelVersion: 'v1.0.0',
      }));
    };

    // Run recovery sweep (simulating scheduled cron/background recovery)
    const sweepResult = await processPendingBatch(10);
    assert.ok(sweepResult.succeeded >= 1);
    assert.equal(sweepResult.failed, 0);

    // Verify submission is now completed with sentiment and topics in database
    const { rows: recoveredRows } = await query(
      'SELECT analysis_status FROM feedback_submissions WHERE id = $1;',
      [failedSubmission.id]
    );
    assert.equal(recoveredRows[0].analysis_status, 'completed');

    const { rows: recoveredSentiment } = await query(
      'SELECT label FROM feedback_sentiment WHERE submission_id = $1;',
      [failedSubmission.id]
    );
    assert.equal(recoveredSentiment.length, 1);
    assert.equal(recoveredSentiment[0].label, 'neutral');
  });
});
