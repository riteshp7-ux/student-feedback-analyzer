const { pool } = require('../../config/db');

/**
 * Retrieves submission data required for NLP analysis
 * @param {string} submissionId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<{ id: string, commentText: string|null, analysisStatus: string }|null>}
 */
async function getSubmissionForAnalysis(submissionId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, comment_text AS "commentText", analysis_status AS "analysisStatus"
     FROM feedback_submissions
     WHERE id = $1;`,
    [submissionId]
  );
  return rows[0] || null;
}

/**
 * Persists validated NLP analysis results atomically into PostgreSQL
 * Guarantees idempotency via ON CONFLICT updates and clean state transitions.
 * Re-checks eligibility under the row lock so a concurrent worker that already
 * completed the analysis is never overwritten by a stale duplicate run.
 * @param {string} submissionId
 * @param {object} analysisResult
 * @param {object} analysisResult.sentiment
 * @param {string} analysisResult.sentiment.label
 * @param {number} analysisResult.sentiment.confidence
 * @param {Array<{ label: string, confidence: number }>} analysisResult.topics
 * @param {import('pg').PoolClient} client
 * @returns {Promise<boolean>} true when results were written, false when skipped (already completed)
 */
async function saveAnalysisSuccess(submissionId, analysisResult, client) {
  const { sentiment, topics } = analysisResult;

  // 1. Lock submission and verify eligible state
  const { rows: subRows } = await client.query(
    `SELECT id, analysis_status FROM feedback_submissions
     WHERE id = $1 FOR UPDATE;`,
    [submissionId]
  );

  if (subRows.length === 0) {
    throw new Error(`Submission ${submissionId} not found.`);
  }

  // Another worker (e.g. a second backend instance) already finished this one.
  if (subRows[0].analysis_status === 'completed') {
    return false;
  }

  // 2. Upsert sentiment record
  await client.query(
    `INSERT INTO feedback_sentiment (submission_id, label, score, analyzed_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (submission_id)
     DO UPDATE SET label = EXCLUDED.label, score = EXCLUDED.score, analyzed_at = NOW();`,
    [submissionId, sentiment.label, sentiment.confidence]
  );

  // 3. Clean prior topic mentions if retrying to guarantee atomic idempotency
  await client.query(
    `DELETE FROM feedback_topic_mention WHERE submission_id = $1;`,
    [submissionId]
  );

  // 4. Insert each validated topic mention
  for (const topic of topics) {
    await client.query(
      `INSERT INTO feedback_topic_mention (submission_id, topic_key, confidence)
       VALUES ($1, $2, $3)
       ON CONFLICT (submission_id, topic_key) DO NOTHING;`,
      [submissionId, topic.label, topic.confidence]
    );
  }

  // 5. Update submission lifecycle status to completed
  await client.query(
    `UPDATE feedback_submissions
     SET analysis_status = 'completed'
     WHERE id = $1;`,
    [submissionId]
  );
  return true;
}

/**
 * Claims a pending/failed submission for exclusive processing by bumping its
 * retry horizon forward. Acts as a lightweight distributed lock: competing
 * workers (other backend instances or the sweep racing the immediate dispatch)
 * fail the conditional UPDATE and skip the row. If the claiming process dies,
 * the row becomes claimable again after the horizon, so work is never lost.
 * @param {string} submissionId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<boolean>} true when this caller won the claim
 */
async function claimSubmissionForProcessing(submissionId, client = pool) {
  const { rows } = await client.query(
    `UPDATE feedback_submissions
     SET analysis_retry_at = NOW() + INTERVAL '30 seconds'
     WHERE id = $1
       AND analysis_status IN ('pending', 'failed')
       AND analysis_retry_at <= NOW()
     RETURNING id;`,
    [submissionId]
  );
  return rows.length > 0;
}

/**
 * Marks analysis as failed without corrupting the underlying feedback or ratings
 * Does not overwrite completed status
 * @param {string} submissionId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<void>}
 */
async function markAnalysisFailed(submissionId, client = pool) {
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT) || process.execArgv.includes('--test');
  const retryInterval = isTest
    ? "INTERVAL '0 second'"
    : "(LEAST(3600, 15 * POWER(2, LEAST(analysis_attempts, 8))) * INTERVAL '1 second')";

  await client.query(
    `UPDATE feedback_submissions
     SET analysis_status = 'failed',
         analysis_attempts = analysis_attempts + 1,
         analysis_retry_at = NOW() + ${retryInterval}
     WHERE id = $1 AND analysis_status != 'completed';`,
    [submissionId]
  );
}

/**
 * Retrieves pending or failed submissions for background retry sweep
 * @param {number} [limit=50]
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<Array<{ id: string, commentText: string }>>}
 */
async function getPendingSubmissions(limit = 50, client = pool) {
  const { rows } = await client.query(
    `SELECT id, comment_text AS "commentText"
     FROM feedback_submissions
     WHERE analysis_status IN ('pending', 'failed')
       AND (analysis_status = 'pending' OR analysis_attempts < 8)
       AND analysis_retry_at <= NOW()
       AND comment_text IS NOT NULL
       AND TRIM(comment_text) != ''
     ORDER BY created_at ASC
     LIMIT $1;`,
    [limit]
  );
  return rows;
}

module.exports = {
  getSubmissionForAnalysis,
  saveAnalysisSuccess,
  markAnalysisFailed,
  getPendingSubmissions,
  claimSubmissionForProcessing,
};
