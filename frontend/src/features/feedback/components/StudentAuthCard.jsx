import React, { useState } from 'react';
import { loginStudent } from '../api/feedbackApi';

const DEMO_STUDENTS = [
  {
    name: 'Kabir Rao (CSE)',
    email: 'kabir@student.university.edu',
    idNumber: 'STU2026005',
    courses: '5 CSE Courses (CS301, CS201, CS303, CS305, CS402)',
  },
  {
    name: 'Aarav Sharma (CSE)',
    email: 'aarav@student.university.edu',
    idNumber: 'STU2026001',
    courses: '5 CSE Courses (CS301, CS201, CS303, CS305, CS405)',
  },
  {
    name: 'Rohan Verma (CSE)',
    email: 'rohan@student.university.edu',
    idNumber: 'STU2026003',
    courses: '5 CSE Courses (CS201, CS303, CS305, CS402, CS405)',
  },
  {
    name: 'Diya Patel (IT)',
    email: 'diya@student.university.edu',
    idNumber: 'STU2026002',
    courses: '4 IT Courses (IT101, IT204, IT302, IT304)',
  },
  {
    name: 'Priya Nair (IT)',
    email: 'priya@student.university.edu',
    idNumber: 'STU2026004',
    courses: '4 IT Courses (IT101, IT204, IT302, IT304)',
  },
];

export default function StudentAuthCard({ onLoginSuccess }) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!loginId.trim() || !password) {
      setError('Please provide your student ID or university email and password.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await loginStudent(loginId.trim(), password);
      localStorage.setItem('student_token', res.token);
      if (onLoginSuccess) {
        onLoginSuccess(res.student);
      }
    } catch (err) {
      setError(
        err.status === 401
          ? 'Invalid student email or password. Check credentials and retry.'
          : err.message || 'Authentication failed. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail) => {
    setLoginId(demoEmail);
    setPassword('SecureStudent123!');
    setIsLoading(true);
    setError(null);
    try {
      const res = await loginStudent(demoEmail, 'SecureStudent123!');
      localStorage.setItem('student_token', res.token);
      if (onLoginSuccess) {
        onLoginSuccess(res.student);
      }
    } catch (err) {
      setError(err.message || 'Demo login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="student-auth-card" role="region" aria-label="Student Sign In">
      <div className="section-intro" style={{ marginBottom: '1rem' }}>
        <h2 className="section-title" style={{ fontSize: '1.25rem' }}>
          Student Sign In Required
        </h2>
        <p className="section-subtitle">
          Please sign in with your university student credentials to access your enrolled courses and submit feedback.
        </p>
      </div>

      {error && (
        <div className="banner banner-error" role="alert" style={{ marginBottom: '1rem' }}>
          <div className="banner-icon" aria-hidden="true">!</div>
          <div className="banner-content">
            <h3 className="banner-title">Authentication Failed</h3>
            <p className="banner-message">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="field-group" style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="student-login-input" className="field-label">
            Student ID or email
          </label>
          <input
            id="student-login-input"
            className="select-input"
            type="text"
            placeholder="e.g. 24U020001"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            disabled={isLoading}
            autoComplete="username"
          />
        </div>

        <div className="field-group" style={{ marginBottom: '1rem' }}>
          <label htmlFor="student-password-input" className="field-label">
            Password
          </label>
          <input
            id="student-password-input"
            className="select-input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', marginBottom: '1.25rem' }}
          disabled={isLoading}
        >
          {isLoading ? 'Signing In...' : 'Sign In as Student'}
        </button>
      </form>

      <div className="demo-accounts-section" style={{ borderTop: '1px solid var(--color-border, #e2e8f0)', paddingTop: '1rem' }}>
        <p className="field-helper" style={{ fontWeight: 600, color: 'var(--color-text-primary, #1e293b)', marginBottom: '0.5rem' }}>
          Demo Test Students (1-Click Sign-In):
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {DEMO_STUDENTS.map((demo) => (
            <button
              key={demo.email}
              type="button"
              className="btn btn-secondary"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                textAlign: 'left',
              }}
              onClick={() => handleDemoLogin(demo.email)}
              disabled={isLoading}
            >
              <div>
                <strong>{demo.name}</strong> ({demo.idNumber})
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #64748b)' }}>
                  Enrolled: {demo.courses}
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-primary, #3b82f6)' }}>
                Sign in →
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
