import React from 'react';
import { useAuth } from '../../auth/AuthContext';

export default function DashboardHeader({
  offerings = [],
  selectedOfferingId = '',
  onSelectOffering,
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
          {offerings.length > 0 && (
            <div className="offering-switcher">
              <label htmlFor="dashboard-offering-select" className="switcher-label">
                Course Offering:
              </label>
              <select
                id="dashboard-offering-select"
                className="select-input select-switcher"
                value={selectedOfferingId}
                onChange={(e) => onSelectOffering(e.target.value)}
              >
                {offerings.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.courseCode}: {o.courseTitle} ({o.term})
                  </option>
                ))}
              </select>
            </div>
          )}

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
