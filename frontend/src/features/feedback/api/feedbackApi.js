import { apiClient } from '../../../shared/api/client';
import { validateCatalogOfferings } from './catalogContract';

/**
 * Fetches all active course offerings available for student feedback
 * @returns {Promise<Array<object>>}
 */
export async function fetchCourseOfferings() {
  const response = await apiClient('/course-offerings');
  const offerings = Array.isArray(response) ? response : response?.data;
  if (!validateCatalogOfferings(offerings)) {
    const error = new Error('The course service returned an older or incomplete catalog. Please retry; if it continues, contact support to update the service.');
    error.code = 'INCOMPATIBLE_CATALOG';
    throw error;
  }
  return offerings;
}

/**
 * Authenticates a student via email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token: string, student: object }>}
 */
export async function loginStudent(loginId, password) {
  return await apiClient('/auth/student/login', {
    method: 'POST',
    body: JSON.stringify({ loginId, password }),
  });
}

/**
 * Retrieves authenticated student profile
 * @returns {Promise<{ student: object }>}
 */
export async function fetchStudentMe() {
  return await apiClient('/student/me');
}

/**
 * Fetches enrolled course offerings for authenticated student
 * @returns {Promise<{ offerings: Array<object> }>}
 */
export async function fetchStudentOfferings() {
  return await apiClient('/student/offerings');
}

/**
 * Submits structured ratings and optional written feedback
 * @param {object} payload
 * @param {string} payload.courseOfferingId
 * @param {object} payload.ratings
 * @param {number} payload.ratings.teachingClarity
 * @param {number} payload.ratings.teachingPace
 * @param {number} payload.ratings.doubtHandling
 * @param {number} payload.ratings.engagement
 * @param {number} payload.ratings.practicalExamples
 * @param {string|null} payload.comment
 * @param {string} [payload.idempotencyKey]
 * @returns {Promise<{ id: string, message?: string }>}
 */
export async function submitStudentFeedback(payload) {
  return await apiClient('/feedback', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
