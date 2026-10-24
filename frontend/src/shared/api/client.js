/**
 * Centralized API client wrapper for frontend HTTP communication.
 * Enforces standardized error formatting, base URLs, and authentication header injection.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export async function apiClient(endpoint, options = {}) {
  let token = null;
  if (typeof window !== 'undefined') {
    if (endpoint.startsWith('/student') || (endpoint === '/feedback' && options.method === 'POST')) {
      token = localStorage.getItem('student_token') || localStorage.getItem('token');
    } else {
      token = localStorage.getItem('token');
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.error?.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.code = data?.error?.code || 'UNKNOWN_ERROR';
    error.details = data?.error?.details || {};
    throw error;
  }

  return data;
}

export async function checkBackendHealth() {
  try {
    const res = await fetch('/health');
    return await res.json();
  } catch (err) {
    return { status: 'unreachable', error: err.message };
  }
}
