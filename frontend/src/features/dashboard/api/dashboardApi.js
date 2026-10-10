import { apiClient } from '../../../shared/api/client';

/**
 * Authenticates professor using email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token: string, professor: { id: string, email: string, fullName: string } }>}
 */
export async function loginProfessor(email, password) {
  return await apiClient('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Retrieves the currently authenticated professor's profile.
 * @returns {Promise<{ professor: { id: string, email: string, fullName: string } }>}
 */
export async function getAuthenticatedProfessor() {
  return await apiClient('/auth/me');
}

/**
 * Retrieves all course offerings assigned to the authenticated professor.
 * @returns {Promise<Array<{ id: string, courseCode: string, courseTitle: string, term: string, isActive: boolean, submissionCount: number }>>}
 */
export async function fetchProfessorOfferings() {
  return await apiClient('/professor/offerings');
}

/**
 * Retrieves 4-level aggregated analytics for a specific course offering.
 * @param {string} courseOfferingId
 * @returns {Promise<object>}
 */
export async function fetchDashboardData(courseOfferingId) {
  return await apiClient(`/dashboard/${courseOfferingId}`);
}

/**
 * Retrieves paginated anonymous student feedback comments with optional topic and sentiment filters.
 * @param {string} courseOfferingId
 * @param {object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.pageSize=15]
 * @param {string} [params.topic]
 * @param {string} [params.sentiment]
 * @returns {Promise<{ pagination: object, comments: Array<object> }>}
 */
export async function fetchEvidenceComments(courseOfferingId, params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.pageSize) query.set('pageSize', params.pageSize);
  if (params.topic) query.set('topic', params.topic);
  if (params.sentiment) query.set('sentiment', params.sentiment);

  const qs = query.toString();
  const endpoint = `/feedback/${courseOfferingId}${qs ? `?${qs}` : ''}`;
  return await apiClient(endpoint);
}
