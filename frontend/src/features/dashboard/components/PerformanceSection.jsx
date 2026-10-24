import React from 'react';

const STATUS_CONFIG = {
  strong: { label: 'Strong', badgeClass: 'badge-strong' },
  moderate: { label: 'Moderate', badgeClass: 'badge-moderate' },
  weak: { label: 'Needs Attention', badgeClass: 'badge-attention' },
};

export default function PerformanceSection({ performance = [] }) {
  if (!performance || performance.length === 0) {
    return null;
  }

  return (
      <section className="dashboard-section level-2-section" aria-labelledby="performance-heading">
        <h2 id="performance-heading" className="dashboard-section-title">Teaching performance</h2>
        <p className="section-note">Average score by teaching area · {performance.length} areas</p>
        <div className="performance-list">
        {performance.map((dim) => {
          const score = Number(dim.averageScore);
          const percent = Math.min(Math.max((score / 5.0) * 100, 0), 100);
          const statusInfo = STATUS_CONFIG[dim.status] || {
            label: dim.status,
            badgeClass: 'badge-neutral',
          };

          return (
            <div key={dim.dimensionKey} className="performance-row">
              <div className="dimension-info">
                <span className="dimension-label">{dim.label}</span>
                <span className={`status-badge ${statusInfo.badgeClass}`}>
                  {statusInfo.label}
                </span>
              </div>

              <div className="dimension-bar-wrapper">
                <div
                  className="dimension-progress-track"
                  role="progressbar"
                  aria-valuenow={score}
                  aria-valuemin="1"
                  aria-valuemax="5"
                  aria-label={`${dim.label}: ${score.toFixed(2)} out of 5.0`}
                >
                  <div
                    className="dimension-progress-fill"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="dimension-score mono">
                  <strong>{score.toFixed(2)}</strong>
                  <span className="score-max">/5.0</span>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </section>
  );
}
