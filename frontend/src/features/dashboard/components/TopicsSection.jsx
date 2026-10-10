import React from 'react';

const SENTIMENT_LABELS = {
  positive: { label: 'Predominantly Positive', class: 'tag-pos' },
  neutral: { label: 'Predominantly Neutral', class: 'tag-neu' },
  negative: { label: 'Needs Attention (Mostly Negative)', class: 'tag-neg' },
};

export default function TopicsSection({
  topics = [],
  selectedTopicKey = null,
  onSelectTopic,
}) {
  if (!topics || topics.length === 0) {
    return null;
  }

  return (
    <section className="dashboard-section level-3-section" aria-labelledby="topics-heading">
      <div className="section-header-compact">
        <h2 id="topics-heading" className="dashboard-section-title">
          Recurring Topics in Student Feedback
        </h2>
        <span className="section-note">
          Extracted themes from student comments. Click any topic to filter supporting evidence below.
        </span>
      </div>

      <div className="topics-grid">
        {topics.map((t) => {
          const isSelected = selectedTopicKey === t.topicKey;
          const sentInfo = SENTIMENT_LABELS[t.dominantSentiment] || {
            label: t.dominantSentiment,
            class: 'tag-neu',
          };

          const dist = t.sentimentDistribution || {};
          const totalMentions = t.mentionCount || 0;

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

              <div className="topic-sentiment-row">
                <span className={`topic-sentiment-tag ${sentInfo.class}`}>
                  {sentInfo.label}
                </span>
              </div>

              {dist && (
                <div className="topic-dist-micro mono">
                  <span>+{dist.positive || 0}</span>
                  <span>={dist.neutral || 0}</span>
                  <span>-{dist.negative || 0}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
