const { pool } = require('../../config/db');

/**
 * Checks if a course offering exists and is currently active
 * @param {string} offeringId
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<{ exists: boolean, isActive: boolean }>}
 */
async function getOfferingStatus(offeringId, client = pool) {
  const { rows } = await client.query(
    `SELECT o.id,
            (o.is_active
              AND (t.feedback_opens_at IS NULL OR NOW() >= t.feedback_opens_at)
              AND (t.feedback_closes_at IS NULL OR NOW() < t.feedback_closes_at)
            ) AS is_active
     FROM course_offerings o
     JOIN academic_terms t ON t.id = o.academic_term_id
     WHERE o.id = $1`,
    [offeringId]
  );
  if (rows.length === 0) return { exists: false, isActive: false };
  return { exists: true, isActive: rows[0].is_active };
}

/**
 * Checks if a student is actively enrolled in a course offering within transaction
 * @param {string} studentId
 * @param {string} offeringId
 * @param {import('pg').PoolClient} client
 * @returns {Promise<boolean>}
 */
async function isStudentEnrolledInOffering(studentId, offeringId, client = pool) {
  const { rows } = await client.query(
    `SELECT 1 FROM course_enrollments
     WHERE student_id = $1 AND course_offering_id = $2;`,
    [studentId, offeringId]
  );
  return rows.length > 0;
}

/**
 * Claims a submission control record for the student and course offering.
 * Guaranteed atomic by UNIQUE (student_id, course_offering_id).
 * Throws on unique constraint conflict if already claimed.
 * @param {string} studentId
 * @param {string} offeringId
 * @param {import('pg').PoolClient} client
 * @returns {Promise<Object>}
 */
async function claimSubmissionControl(studentId, offeringId, client) {
  const { rows } = await client.query(
    `INSERT INTO feedback_submission_control (student_id, course_offering_id)
     VALUES ($1, $2)
     RETURNING id, student_id, course_offering_id, submitted_at;`,
    [studentId, offeringId]
  );
  return rows[0];
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
      analysis_status,
      idempotency_key
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
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
      submission.idempotencyKey || null,
    ]
  );
  return rows[0]?.id || null;
}

async function getSubmissionByIdempotencyKey(idempotencyKey, client = pool) {
  const { rows } = await client.query(
    `SELECT id, offering_id, rating_clarity, rating_pace, rating_doubt_handling,
            rating_engagement, rating_practical_examples, comment_text
     FROM feedback_submissions WHERE idempotency_key = $1;`,
    [idempotencyKey]
  );
  return rows[0] || null;
}

module.exports = {
  getOfferingStatus,
  isStudentEnrolledInOffering,
  claimSubmissionControl,
  insertFeedbackSubmission,
  getSubmissionByIdempotencyKey,
};
