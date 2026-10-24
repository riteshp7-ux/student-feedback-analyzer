import React from 'react';

export default function OverviewSection({
  overall = {},
  performance = [],
  privacyThresholdMet = true,
  commentInsightsAvailable = true,
  commentInsightsMessage = '',
  message = '',
}) {
  const { responseCount = 0, averageRating, sentimentDistribution } = overall;
  const analysisLifecycle = overall.analysisLifecycle || {};

  const totalSentiment = sentimentDistribution
    ? (sentimentDistribution.positive || 0) +
      (sentimentDistribution.neutral || 0) +
      (sentimentDistribution.negative || 0)
    : 0;

  const posPct = totalSentiment > 0 ? Math.round((sentimentDistribution.positive / totalSentiment) * 100) : 0;
  const neuPct = totalSentiment > 0 ? Math.round((sentimentDistribution.neutral / totalSentiment) * 100) : 0;
  const negPct = totalSentiment > 0 ? Math.round((sentimentDistribution.negative / totalSentiment) * 100) : 0;
  const focusDimension = performance.find((dimension) => dimension.status === 'weak');
  const strengthDimension = performance.find((dimension) => dimension.status === 'strong');
  const highlightedDimension = focusDimension || strengthDimension;

  return (
    <section className="dashboard-section level-1-section" aria-labelledby="overview-heading">
      <div className="section-header-compact">
        <h2 id="overview-heading" className="dashboard-section-title">
        At a glance
        </h2>
        <span className="privacy-badge">
          {privacyThresholdMet ? '5+ responses' : 'Private until 5 responses'}
        </span>
      </div>

      <div className="overview-metrics-grid">
        <div className="metric-panel">
          <span className="metric-label">Average rating</span>
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
            {privacyThresholdMet ? 'Across 5 rating areas' : 'Private for small groups'}
          </span>
        </div>

        <div className="metric-panel">
          <span className="metric-label">Responses</span>
          <div className="metric-value-row">
            <span className="metric-value mono">{responseCount}</span>
            <span className="metric-unit">rating responses</span>
          </div>
        </div>

        <div className="metric-panel">
          <span className="metric-label">Comment sentiment</span>
          {sentimentDistribution && totalSentiment > 0 ? (
            <div className="sentiment-bar-container">
              <div className="sentiment-stacked-bar" role="img" aria-label={`Sentiment distribution: ${posPct}% positive, ${neuPct}% neutral, ${negPct}% negative`}>
                <div className="bar-segment bar-pos" style={{ width: `${posPct}%` }} />
                <div className="bar-segment bar-neu" style={{ width: `${neuPct}%` }} />
                <div className="bar-segment bar-neg" style={{ width: `${negPct}%` }} />
              </div>
              <div className="sentiment-summary-legend" aria-hidden="true">
                <span className="stat-pos">{posPct}% positive</span>
                <span className="stat-neu">{neuPct}% neutral</span>
                <span className="stat-neg">{negPct}% negative</span>
              </div>
              <span className="metric-subtext">Based on {totalSentiment} analyzed comments</span>
            </div>
          ) : (
            <div className="sentiment-empty">
              <span className="metric-muted">
                {commentInsightsAvailable
                  ? 'No analyzed comments yet'
                  : commentInsightsMessage || (privacyThresholdMet
                    ? 'Comment insights will appear after 5 comments are analyzed.'
                    : 'Available after 5 responses')}
              </span>
            </div>
          )}
          {(analysisLifecycle.pending > 0 || analysisLifecycle.retrying > 0 || analysisLifecycle.failed > 0) && (
            <p className="metric-subtext" role="status" aria-live="polite">
              {[
                analysisLifecycle.pending > 0 && `${analysisLifecycle.pending} pending`,
                analysisLifecycle.retrying > 0 && `${analysisLifecycle.retrying} retrying`,
                analysisLifecycle.failed > 0 && `${analysisLifecycle.failed} failed after retries`,
              ].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {privacyThresholdMet && highlightedDimension && (
        <p className={`overview-highlight ${focusDimension ? 'overview-highlight-focus' : ''}`} role="note">
          <span>{focusDimension ? 'Focus area' : 'Strongest area'}</span>
          <strong>{highlightedDimension.label}</strong>
        </p>
      )}

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
