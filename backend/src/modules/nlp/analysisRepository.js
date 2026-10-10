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
 * Guarantees idempotency via ON CONFLICT updates and clean state transitions
 * @param {string} submissionId
 * @param {object} analysisResult
 * @param {object} analysisResult.sentiment
 * @param {string} analysisResult.sentiment.label
 * @param {number} analysisResult.sentiment.confidence
 * @param {Array<{ label: string, confidence: number }>} analysisResult.topics
 * @param {import('pg').PoolClient} client
 * @returns {Promise<void>}
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
}

/**
 * Marks analysis as failed without corrupting the underlying feedback or ratings
 * Does not overwrite completed status
 * @param {string} submissionId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<void>}
 */
async function markAnalysisFailed(submissionId, client = pool) {
  await client.query(
    `UPDATE feedback_submissions
     SET analysis_status = 'failed'
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
};
