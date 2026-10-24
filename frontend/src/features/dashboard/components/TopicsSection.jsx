import React from 'react';

const SENTIMENT_LABELS = {
  positive: { label: 'Positive', class: 'tag-pos' },
  neutral: { label: 'Neutral', class: 'tag-neu' },
  negative: { label: 'Negative', class: 'tag-neg' },
};

export default function TopicsSection({
  topics = [],
  commentInsightsAvailable = true,
  emptyMessage = '',
  selectedTopicKey = null,
  onSelectTopic,
}) {
  return (
      <section className="dashboard-section level-3-section" aria-labelledby="topics-heading">
        <h2 id="topics-heading" className="dashboard-section-title">Common themes</h2>
        {!commentInsightsAvailable || topics.length === 0 ? (
          <p className="section-note" role="status">
            {!commentInsightsAvailable
              ? emptyMessage || 'Comment themes will appear after at least 5 comments are analyzed.'
              : 'No recurring themes were detected in the analyzed comments.'}
          </p>
        ) : (
        <>
        <p className="section-note">{topics.length} themes · Select one to filter comments</p>
        <div className="topics-grid">
        {topics.map((t) => {
          const isSelected = selectedTopicKey === t.topicKey;
          const sentInfo = SENTIMENT_LABELS[t.dominantSentiment] || {
            label: t.dominantSentiment,
            class: 'tag-neu',
          };

          const dist = t.sentimentDistribution || {};
          const totalMentions = t.mentionCount || 0;
          const positive = dist.positive || 0;
          const neutral = dist.neutral || 0;
          const negative = dist.negative || 0;
          const sentimentTotal = positive + neutral + negative;
          const positivePct = sentimentTotal ? (positive / sentimentTotal) * 100 : 0;
          const neutralPct = sentimentTotal ? (neutral / sentimentTotal) * 100 : 0;

          return (
            <button
              type="button"
              key={t.topicKey}
              className={`topic-card ${isSelected ? 'topic-card-selected' : ''}`}
              onClick={() => onSelectTopic(isSelected ? null : t.topicKey)}
              aria-pressed={isSelected}
            >
              <div className="topic-card-header">
                <span className="topic-name">{t.label}</span>
                <span className="topic-count mono">{totalMentions} mentions</span>
              </div>

              <span className={`topic-sentiment-tag ${sentInfo.class}`}>{sentInfo.label}</span>
              <span
                className="topic-distribution-bar"
                role="img"
                aria-label={`${t.label} sentiment: ${positive} positive, ${neutral} neutral, ${negative} negative`}
              >
                <span className="topic-dist-positive" style={{ width: `${positivePct}%` }} />
                <span className="topic-dist-neutral" style={{ width: `${neutralPct}%` }} />
                <span className="topic-dist-negative" style={{ width: `${sentimentTotal ? 100 - positivePct - neutralPct : 0}%` }} />
              </span>
            </button>
          );
        })}
        </div>
        </>
        )}
      </section>
  );
}
