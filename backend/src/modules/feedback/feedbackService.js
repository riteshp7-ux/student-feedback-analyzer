const { pool } = require('../../config/db');
const {
  getOfferingStatus,
  isStudentEnrolledInOffering,
  claimSubmissionControl,
  insertFeedbackSubmission,
  getSubmissionByIdempotencyKey,
} = require('./feedbackRepository');
const { scheduleAnalysis } = require('../nlp/analysisService');

class DomainError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Service orchestrating feedback submission for authenticated student:
 * 1. Checks idempotency key for immediate identical retry handling
 * 2. Verifies course offering existence and active status
 * 3. Verifies student enrollment in course offering (HTTP 403 if not enrolled)
 * 4. Claims/creates submission-control record (HTTP 409 if already submitted)
 * 5. Persists anonymous feedback record in feedback_submissions (NO student_id)
 * 6. Commits transaction
 * 7. Triggers asynchronous NLP analysis outside the transaction
 * @param {object} payload - Validated submission data
 * @param {string} studentId - Authenticated student UUID derived from JWT session
 * @returns {Promise<{ id: string, duplicate?: boolean }>}
 */
async function submitFeedback(payload, studentId) {
  if (!studentId) {
    throw new DomainError(
      'UNAUTHORIZED',
      'Authenticated student identity is required to submit feedback.',
      401
    );
  }

  const client = await pool.connect();
  let submissionId;
  let isDuplicate = false;
  try {
    await client.query('BEGIN');

    // 1. Idempotency Check:
    // If the exact network request is retried with the same idempotency key:
    if (payload.idempotencyKey) {
      const existing = await getSubmissionByIdempotencyKey(payload.idempotencyKey, client);
      if (existing) {
        if (!matchesPayload(existing, payload)) {
          throw new DomainError(
            'IDEMPOTENCY_KEY_REUSED',
            'This submission key was already used for different feedback.',
            409
          );
        }
        submissionId = existing.id;
        isDuplicate = true;
        await client.query('COMMIT');
        return { id: submissionId, duplicate: true };
      }
    }

    // 2. Verify offering exists and is active
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

    // 3. Verify student enrollment
    const isEnrolled = await isStudentEnrolledInOffering(studentId, payload.courseOfferingId, client);
    if (!isEnrolled) {
      throw new DomainError(
        'STUDENT_NOT_ENROLLED',
        'You are not enrolled in this course offering.',
        403,
        { courseOfferingId: payload.courseOfferingId }
      );
    }

    // 4. Claim submission control record (Enforces one submission per student per offering)
    try {
      await claimSubmissionControl(studentId, payload.courseOfferingId, client);
    } catch (err) {
      if (err.code === '23505') {
        // Postgres unique violation on (student_id, course_offering_id)
        throw new DomainError(
          'ALREADY_SUBMITTED',
          'Feedback has already been submitted for this course offering.',
          409,
          { courseOfferingId: payload.courseOfferingId }
        );
      }
      throw err;
    }

    // 5. Determine lifecycle state based on presence of written comment
    const analysisStatus = payload.comment ? 'pending' : 'not_applicable';

    // 6. Persist anonymous feedback submission record (NO student identity in feedback_submissions)
    submissionId = await insertFeedbackSubmission(
      {
        offeringId: payload.courseOfferingId,
        ratings: payload.ratings,
        comment: payload.comment,
        analysisStatus,
        idempotencyKey: payload.idempotencyKey,
      },
      client
    );

    // Another request may have committed the same key after our initial read.
    if (!submissionId && payload.idempotencyKey) {
      const existing = await getSubmissionByIdempotencyKey(payload.idempotencyKey, client);
      if (!existing || !matchesPayload(existing, payload)) {
        throw new DomainError(
          'IDEMPOTENCY_KEY_REUSED',
          'This submission key was already used for different feedback.',
          409
        );
      }
      submissionId = existing.id;
      isDuplicate = true;
    }

    await client.query('COMMIT');

    // 7. Trigger asynchronous NLP analysis outside the transaction boundary
    // NLP receives only submissionId (which loads only comment_text; zero student identity)
    if (payload.comment && !isDuplicate && submissionId) {
      scheduleAnalysis(submissionId);
    }

    return { id: submissionId, duplicate: isDuplicate };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function matchesPayload(existing, payload) {
  return existing.offering_id === payload.courseOfferingId &&
    existing.rating_clarity === payload.ratings.teachingClarity &&
    existing.rating_pace === payload.ratings.teachingPace &&
    existing.rating_doubt_handling === payload.ratings.doubtHandling &&
    existing.rating_engagement === payload.ratings.engagement &&
    existing.rating_practical_examples === payload.ratings.practicalExamples &&
    existing.comment_text === (payload.comment || null);
}

module.exports = {
  submitFeedback,
  DomainError,
};
