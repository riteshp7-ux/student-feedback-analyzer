import React from 'react';

export default function Header({ onNavigateFaculty }) {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="header-brand">
          <span className="brand-badge">Academic Feedback</span>
          <h1 className="header-title">Student Feedback System</h1>
        </div>
        <div className="header-meta">
          <span className="term-indicator">Active Evaluation Period</span>
          {onNavigateFaculty && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onNavigateFaculty}
              style={{ marginLeft: '12px' }}
            >
              Faculty Portal →
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
