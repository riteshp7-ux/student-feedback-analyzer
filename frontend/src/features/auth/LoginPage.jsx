import React, { useState } from 'react';
import { useAuth } from './AuthContext';

export default function LoginPage({ onLoginSuccess, onNavigateHome }) {
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
          <div className="login-header-top">
            <span className="brand-badge">Academic Portal</span>
            {onNavigateHome && (
              <button
                type="button"
                className="btn-text-link"
                onClick={onNavigateHome}
                title="Return to Student Feedback Form"
              >
                ← Student Portal
              </button>
            )}
          </div>
          <h1 className="login-title">Faculty Sign In</h1>
          <p className="login-subtitle">
            Sign in with institutional credentials to review student feedback and teaching analytics.
          </p>
          <div className="demo-credentials-box" style={{
            background: 'var(--color-bg-secondary, #f8fafc)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '6px',
            padding: '0.65rem 0.85rem',
            margin: '0.75rem 0',
            fontSize: '0.82rem',
            color: 'var(--color-text-secondary, #475569)'
          }}>
            <strong style={{ color: 'var(--color-text-primary, #0f172a)' }}>Faculty Demo Accounts (Password: <code>SecurePassword123!</code>):</strong>
            <div style={{ marginTop: '0.4rem', fontFamily: 'monospace', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ cursor: 'pointer' }} onClick={() => { setEmail('sharma@university.edu'); setPassword('SecurePassword123!'); }} title="Click to fill">
                • <code>sharma@university.edu</code> — Dr. Ramesh Sharma (CSE: CS301, IT: IT304 · Active Period)
              </div>
              <div style={{ cursor: 'pointer' }} onClick={() => { setEmail('desai@university.edu'); setPassword('SecurePassword123!'); }} title="Click to fill">
                • <code>desai@university.edu</code> — Prof. Anita Desai (CSE: CS201, IT: IT204 · 90 responses each)
              </div>
              <div style={{ cursor: 'pointer' }} onClick={() => { setEmail('kavya.menon@university.edu'); setPassword('SecurePassword123!'); }} title="Click to fill">
                • <code>kavya.menon@university.edu</code> — Prof. Kavya Menon (CSE: CS405, IT: IT101 · 25 responses each)
              </div>
              <div style={{ cursor: 'pointer' }} onClick={() => { setEmail('arjun.mehta@university.edu'); setPassword('SecurePassword123!'); }} title="Click to fill">
                • <code>arjun.mehta@university.edu</code> — Prof. Arjun Mehta (CSE only: CS305, CS402 · 18 responses each)
              </div>
              <div style={{ cursor: 'pointer' }} onClick={() => { setEmail('vikram.singh@university.edu'); setPassword('SecurePassword123!'); }} title="Click to fill">
                • <code>vikram.singh@university.edu</code> — Dr. Vikram Singh (CSE: CS303 [0 responses, N&lt;5], IT: IT302 [38 responses])
              </div>
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', fontStyle: 'italic', color: 'var(--color-text-muted, #64748b)' }}>
              Tip: Click any faculty account above to auto-fill.
            </div>
          </div>
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
