import React from 'react';
import { useAuth } from '../../auth/AuthContext';

export default function DashboardHeader({
  onNavigateHome,
}) {
  const { professor, logout } = useAuth();

  return (
    <header className="dashboard-header">
      <div className="dashboard-header-inner">
        <div className="dashboard-brand">
          <div className="brand-badge-row">
            <span className="brand-badge">Faculty Analytics</span>
            {onNavigateHome && (
              <button
                type="button"
                className="btn-text-link"
                onClick={onNavigateHome}
                title="Go to Student Feedback Portal"
              >
                ← Student Portal
              </button>
            )}
          </div>
          <h1 className="dashboard-app-title">Student Feedback Analyzer</h1>
        </div>

        <div className="dashboard-controls">
          <div className="faculty-profile">
            <span className="faculty-name">{professor?.fullName || 'Faculty Member'}</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={logout}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
