const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const {
  findStudentByLoginId,
  findStudentById,
  getEnrolledOfferingsByStudentId,
  isStudentEnrolled,
  hasStudentSubmittedOffering,
  recordSubmissionControl,
} = require('./studentRepository');

/**
 * Custom student domain error
 */
class StudentDomainError extends Error {
  constructor(message, code, status = 400, details = {}) {
    super(message);
    this.name = 'StudentDomainError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Authenticates a student using email and password, issuing a signed 24h JWT.
 * Payload: { studentId: uuid, email: string, role: 'student' }
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token: string, student: Object }>}
 */
async function authenticateStudent(loginId, password) {
  if (!loginId || !password || typeof loginId !== 'string' || typeof password !== 'string') {
    throw new StudentDomainError('Invalid student ID or password.', 'INVALID_CREDENTIALS', 401);
  }

  const normalizedLoginId = loginId.trim();
  const student = await findStudentByLoginId(normalizedLoginId);

  if (!student) {
    // Constant time dummy hash compare
    await bcrypt.compare(password, '$2b$10$1234567890123456789012345678901234567890123456789012');
    throw new StudentDomainError('Invalid student ID or password.', 'INVALID_CREDENTIALS', 401);
  }

  const isPasswordMatch = await bcrypt.compare(password, student.password_hash);
  if (!isPasswordMatch) {
    throw new StudentDomainError('Invalid student ID or password.', 'INVALID_CREDENTIALS', 401);
  }

  const tokenPayload = {
    studentId: student.id,
    email: student.email,
    role: 'student',
  };

  const token = jwt.sign(tokenPayload, env.JWT_SECRET, {
    expiresIn: '24h',
  });

  return {
    token,
    student: {
      id: student.id,
      email: student.email,
      studentIdNumber: student.student_id_number,
      fullName: student.full_name,
    },
  };
}

/**
 * Retrieves student profile by studentId.
 * @param {string} studentId
 */
async function getStudentProfile(studentId) {
  const student = await findStudentById(studentId);
  if (!student) {
    throw new StudentDomainError('Student profile not found.', 'STUDENT_NOT_FOUND', 404);
  }
  return {
    id: student.id,
    email: student.email,
    studentIdNumber: student.student_id_number,
    fullName: student.full_name,
    createdAt: student.created_at,
  };
}

/**
 * Retrieves enrolled course offerings with submission status for a student.
 * @param {string} studentId
 */
async function getStudentEnrolledOfferings(studentId) {
  return await getEnrolledOfferingsByStudentId(studentId);
}

/**
 * Validates enrollment and records submission control.
 * Throws 403 if student is not enrolled.
 * Throws 409 if student has already submitted feedback for this course offering.
 * @param {string} studentId
 * @param {string} courseOfferingId
 */
async function recordStudentSubmissionControl(studentId, courseOfferingId) {
  const enrolled = await isStudentEnrolled(studentId, courseOfferingId);
  if (!enrolled) {
    throw new StudentDomainError(
      'You are not enrolled in this course offering.',
      'STUDENT_NOT_ENROLLED',
      403,
      { courseOfferingId }
    );
  }

  const alreadySubmitted = await hasStudentSubmittedOffering(studentId, courseOfferingId);
  if (alreadySubmitted) {
    throw new StudentDomainError(
      'Feedback has already been submitted for this course offering.',
      'ALREADY_SUBMITTED',
      409,
      { courseOfferingId }
    );
  }

  try {
    return await recordSubmissionControl(studentId, courseOfferingId);
  } catch (err) {
    if (err.code === '23505') { // Postgres unique_violation
      throw new StudentDomainError(
        'Feedback has already been submitted for this course offering.',
        'ALREADY_SUBMITTED',
        409,
        { courseOfferingId }
      );
    }
    throw err;
  }
}

module.exports = {
  StudentDomainError,
  authenticateStudent,
  getStudentProfile,
  getStudentEnrolledOfferings,
  recordStudentSubmissionControl,
};
