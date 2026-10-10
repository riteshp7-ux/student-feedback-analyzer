import React from 'react';

export default function OverviewSection({
  overall = {},
  privacyThresholdMet = true,
  message = '',
}) {
  const { responseCount = 0, averageRating, sentimentDistribution } = overall;

  const totalSentiment = sentimentDistribution
    ? (sentimentDistribution.positive || 0) +
      (sentimentDistribution.neutral || 0) +
      (sentimentDistribution.negative || 0)
    : 0;

  const posPct = totalSentiment > 0 ? Math.round((sentimentDistribution.positive / totalSentiment) * 100) : 0;
  const neuPct = totalSentiment > 0 ? Math.round((sentimentDistribution.neutral / totalSentiment) * 100) : 0;
  const negPct = totalSentiment > 0 ? Math.round((sentimentDistribution.negative / totalSentiment) * 100) : 0;

  return (
    <section className="dashboard-section level-1-section" aria-labelledby="overview-heading">
      <div className="section-header-compact">
        <h2 id="overview-heading" className="dashboard-section-title">
          Overall Course Feedback Pulse
        </h2>
        <span className="privacy-badge">
          {privacyThresholdMet ? 'Sample Size Sufficient (N ≥ 5)' : 'Privacy Threshold Guard'}
        </span>
      </div>

      <div className="overview-metrics-grid">
        {/* Metric 1: Overall Average Rating */}
        <div className="metric-panel">
          <span className="metric-label">Overall Average Rating</span>
          <div className="metric-value-row">
            {averageRating !== null && averageRating !== undefined ? (
              <>
                <span className="metric-value mono">{Number(averageRating).toFixed(2)}</span>
                <span className="metric-scale">/ 5.0</span>
              </>
            ) : (
              <span className="metric-muted mono">—</span>
            )}
          </div>
          <span className="metric-subtext">
            {privacyThresholdMet
              ? 'Weighted average across 5 pedagogical dimensions'
              : 'Hidden to preserve anonymity (N < 5)'}
          </span>
        </div>

        {/* Metric 2: Total Responses */}
        <div className="metric-panel">
          <span className="metric-label">Total Submissions</span>
          <div className="metric-value-row">
            <span className="metric-value mono">{responseCount}</span>
            <span className="metric-unit">Students</span>
          </div>
          <span className="metric-subtext">
            100% anonymous responses recorded
          </span>
        </div>

        {/* Metric 3: Sentiment Distribution */}
        <div className="metric-panel">
          <span className="metric-label">Written Sentiment Breakdown</span>
          {sentimentDistribution && totalSentiment > 0 ? (
            <div className="sentiment-bar-container">
              <div className="sentiment-percentages-row">
                <span className="sentiment-stat stat-pos">+{posPct}% Pos</span>
                <span className="sentiment-stat stat-neu">={neuPct}% Neu</span>
                <span className="sentiment-stat stat-neg">-{negPct}% Neg</span>
              </div>
              <div className="sentiment-stacked-bar" role="img" aria-label={`Sentiment distribution: ${posPct}% positive, ${neuPct}% neutral, ${negPct}% negative`}>
                <div className="bar-segment bar-pos" style={{ width: `${posPct}%` }} />
                <div className="bar-segment bar-neu" style={{ width: `${neuPct}%` }} />
                <div className="bar-segment bar-neg" style={{ width: `${negPct}%` }} />
              </div>
              <span className="metric-subtext">
                Derived from {totalSentiment} written comments
              </span>
            </div>
          ) : (
            <div className="sentiment-empty">
              <span className="metric-muted">
                {privacyThresholdMet
                  ? 'No written comments available'
                  : 'Analytics paused for cohort privacy'}
              </span>
            </div>
          )}
        </div>
      </div>

      {!privacyThresholdMet && message && (
        <div className="banner banner-info" role="status" style={{ marginTop: '16px' }}>
          <div className="banner-icon">ℹ</div>
          <div className="banner-content">
            <p className="banner-message">{message}</p>
          </div>
        </div>
      )}
    </section>
  );
}
