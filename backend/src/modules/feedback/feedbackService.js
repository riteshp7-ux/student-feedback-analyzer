const { pool } = require('../../config/db');
const { getOfferingStatus, insertFeedbackSubmission } = require('./feedbackRepository');
const { scheduleAnalysis } = require('../nlp/analysisService');

class DomainError extends Error {

  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Service orchestrating feedback submission:
 * 1. Verifies course offering existence and active status
 * 2. Determines initial NLP analysis lifecycle state:
 *    - 'not_applicable' if no comment text
 *    - 'pending' if comment text is present (ready for future NLP stage)
 * 3. Executes atomic database transaction
 * @param {object} payload - Validated submission data
 * @returns {Promise<{ id: string }>}
 */
async function submitFeedback(payload) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify offering exists and is active
    const offeringStatus = await getOfferingStatus(payload.courseOfferingId, client);
    if (!offeringStatus.exists) {
      throw new DomainError(
        'RESOURCE_NOT_FOUND',
        'The specified course offering does not exist.',
        404
      );
    }
    if (!offeringStatus.isActive) {
      throw new DomainError(
        'OFFERING_INACTIVE',
        'This course offering is no longer accepting feedback submissions.',
        400
      );
    }

    // 2. Determine lifecycle state based on presence of written comment
    const analysisStatus = payload.comment ? 'pending' : 'not_applicable';

    // 3. Persist feedback submission record
    const submissionId = await insertFeedbackSubmission(
      {
        offeringId: payload.courseOfferingId,
        ratings: payload.ratings,
        comment: payload.comment,
        analysisStatus,
      },
      client
    );

    await client.query('COMMIT');

    // Trigger asynchronous NLP analysis outside the transaction boundary
    if (payload.comment) {
      scheduleAnalysis(submissionId);
    }

    return { id: submissionId };
  } catch (err) {

    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  submitFeedback,
  DomainError,
};
