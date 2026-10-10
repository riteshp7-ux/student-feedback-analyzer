import { apiClient } from '../../../shared/api/client';

/**
 * Fetches all active course offerings available for student feedback
 * @returns {Promise<Array<object>>}
 */
export async function fetchCourseOfferings() {
  const response = await apiClient('/course-offerings');
  if (Array.isArray(response)) {
    return response;
  }
  return response?.data || [];
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
 * @returns {Promise<{ id: string, message?: string }>}
 */
export async function submitStudentFeedback(payload) {
  return await apiClient('/feedback', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
