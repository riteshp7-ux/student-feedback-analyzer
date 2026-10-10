import React, { useState } from 'react';
import { useAuth } from './AuthContext';

export default function LoginPage({ onLoginSuccess }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please provide both institutional email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err) {
      setError(
        err.status === 401
          ? 'Invalid institutional email or password.'
          : 'Unable to connect to the authentication server. Please verify your connection.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-card">
        <div className="login-header">
          <span className="brand-badge">Academic Portal</span>
          <h1 className="login-title">Faculty Sign In</h1>
          <p className="login-subtitle">
            Sign in with institutional credentials to review student feedback and teaching analytics.
          </p>
        </div>

        {error && (
          <div className="banner banner-error" role="alert">
            <span className="banner-icon" aria-hidden="true">!</span>
            <div className="banner-content">
              <p className="banner-message">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="form-group">
            <label htmlFor="login-email" className="field-label">
              Institutional Email
            </label>
            <input
              id="login-email"
              type="email"
              className="select-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. sharma@university.edu"
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="field-label">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              className="select-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <div className="login-actions">
            <button
              type="submit"
              className="btn btn-primary btn-submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner spinner-white" aria-hidden="true"></span>
                  <span>Signing In...</span>
                </>
              ) : (
                'Sign In to Dashboard'
              )}
            </button>
          </div>
        </form>

        <div className="login-footer">
          <p className="footer-note">
            Student feedback is protected and delivered in aggregated form to ensure anonymity.
          </p>
        </div>
      </div>
    </div>
  );
}
