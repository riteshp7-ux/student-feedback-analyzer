const { pool } = require('../../config/db');

/**
 * Checks if a course offering exists and is currently active
 * @param {string} offeringId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<boolean>}
 */
async function getOfferingStatus(offeringId, client = pool) {
  const { rows } = await client.query(
    'SELECT id, is_active FROM course_offerings WHERE id = $1',
    [offeringId]
  );
  if (rows.length === 0) return { exists: false, isActive: false };
  return { exists: true, isActive: rows[0].is_active };
}

/**
 * Inserts a feedback submission record atomically
 * @param {object} submission
 * @param {string} submission.offeringId
 * @param {object} submission.ratings
 * @param {string|null} submission.comment
 * @param {string} submission.analysisStatus
 * @param {import('pg').PoolClient} client
 * @returns {Promise<string>} Created submission UUID
 */
async function insertFeedbackSubmission(submission, client) {
  const { offeringId, ratings, comment, analysisStatus } = submission;
  const { rows } = await client.query(
    `INSERT INTO feedback_submissions (
      offering_id,
      rating_clarity,
      rating_pace,
      rating_doubt_handling,
      rating_engagement,
      rating_practical_examples,
      comment_text,
      analysis_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id;`,
    [
      offeringId,
      ratings.teachingClarity,
      ratings.teachingPace,
      ratings.doubtHandling,
      ratings.engagement,
      ratings.practicalExamples,
      comment,
      analysisStatus,
    ]
  );
  return rows[0].id;
}

module.exports = {
  getOfferingStatus,
  insertFeedbackSubmission,
};
