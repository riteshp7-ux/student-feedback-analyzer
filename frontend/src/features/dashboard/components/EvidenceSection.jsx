import React from 'react';

const SENTIMENT_BADGES = {
  positive: { label: 'Positive', class: 'comment-badge-pos' },
  neutral: { label: 'Neutral', class: 'comment-badge-neu' },
  negative: { label: 'Negative', class: 'comment-badge-neg' },
};

const TOPIC_LABELS = {
  teaching_clarity: 'Teaching Clarity',
  teaching_pace: 'Teaching Pace',
  practical_examples: 'Practical Examples',
  doubt_handling: 'Doubt Handling',
  engagement: 'Student Engagement',
  assignments: 'Assignments & Workload',
  course_content: 'Curriculum & Content',
};

export default function EvidenceSection({
  comments = [],
  pagination = {},
  selectedTopic = null,
  selectedSentiment = null,
  onTopicChange,
  onSentimentChange,
  onPageChange,
  isLoading = false,
  error = null,
  onRetry,
  privacySuppressed = false,
  privacyMessage = '',
}) {
  const { currentPage = 1, totalPages = 1, totalComments = 0 } = pagination;

  return (
      <section className="dashboard-section level-4-section" aria-labelledby="evidence-heading">
        <div className="evidence-heading">
          <div>
            <h2 id="evidence-heading" className="dashboard-section-title">Student comments</h2>
            <p className={`section-note ${error ? 'has-error' : ''}`} role={error || privacySuppressed ? 'status' : undefined}>
              {error
                ? 'Could not load comments. Try again.'
                : privacySuppressed
                ? privacyMessage || 'Written feedback is hidden until at least 5 matching comments are available.'
                : `${totalComments} ${totalComments === 1 ? 'comment' : 'comments'} · Filter by topic or sentiment`}
            </p>
          </div>
          <div className="evidence-controls">
            <select
              className="select-input select-filter"
              value={selectedSentiment || ''}
              onChange={(e) => onSentimentChange(e.target.value || null)}
              aria-label="Filter comments by sentiment"
            >
              <option value="">All Sentiments</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>
        </div>

      {selectedTopic && (
        <div className="active-filter-banner">
          <span>
            Filtering by topic: <strong>{TOPIC_LABELS[selectedTopic] || selectedTopic}</strong>
          </span>
          <button
            type="button"
            className="btn-text-clear"
            onClick={() => onTopicChange(null)}
          >
            Clear Filter ×
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="evidence-loading" role="status">
          <span className="spinner"></span>
          <span>Loading student comments...</span>
        </div>
      ) : error ? (
        <div className="evidence-load-error" role="alert">
          <p>{error}</p>
          {onRetry && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      ) : comments.length === 0 ? (
        <div className="evidence-empty" role="status">
          <p>
            {privacySuppressed
              ? privacyMessage || 'Written feedback is hidden until at least 5 matching comments are available.'
              : 'No written feedback matches the selected filters.'}
          </p>
          {(selectedTopic || selectedSentiment) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                onTopicChange(null);
                onSentimentChange(null);
              }}
              style={{ marginTop: '8px' }}
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="comments-list">
          {comments.map((comment) => {
            const isPending = comment.analysisStatus === 'pending';
            const isFailed = comment.analysisStatus === 'failed';

            let statusBadge = null;
            if (isPending) {
              statusBadge = (
                <span className="comment-sentiment-badge comment-badge-pending" title="AI analysis queued">
                  ⏳ Analysis Pending
                </span>
              );
            } else if (isFailed) {
              statusBadge = (
                <span className="comment-sentiment-badge comment-badge-pending" title="Analysis is retried automatically in the background; the written comment remains available">
                  Analysis delayed
                </span>
              );
            } else if (comment.sentiment) {
              const sentBadge = SENTIMENT_BADGES[comment.sentiment] || {
                label: comment.sentiment,
                class: 'comment-badge-neu',
              };
              statusBadge = (
                <span className={`comment-sentiment-badge ${sentBadge.class}`}>
                  {sentBadge.label}
                </span>
              );
            }

            return (
              <article key={comment.id} className="comment-card">
                <div className="comment-card-header">
                  <div className="comment-meta-left">
                    {statusBadge}
                    {comment.submittedMonth && (
                      <span className="comment-date mono">{comment.submittedMonth}</span>
                    )}
                  </div>
                </div>

                <p className="comment-text">"{comment.commentText}"</p>

                {comment.topics && comment.topics.length > 0 && (
                  <div className="comment-topics-row">
                    {comment.topics.map((t) => (
                      <span key={t} className="comment-topic-pill">
                        {TOPIC_LABELS[t] || t}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="evidence-pagination">
          <span className="pagination-info mono">
            Page {currentPage} of {totalPages} ({totalComments} comments)
          </span>

          <div className="pagination-buttons">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => onPageChange(currentPage - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => onPageChange(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
      </section>
  );
}
