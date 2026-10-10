import React from 'react';

const MAX_CHARS = 2000;

export default function CommentField({
  value = '',
  onChange,
  error,
}) {
  const currentLength = value.length;
  const isOverLimit = currentLength > MAX_CHARS;
  const isNearLimit = currentLength >= 1800 && !isOverLimit;

  return (
    <div className={`comment-field-group ${error || isOverLimit ? 'field-invalid' : ''}`}>
      <div className="field-header-row">
        <label htmlFor="feedback-comment" className="field-label">
          Constructive Comments <span className="optional-tag">(Optional)</span>
        </label>
        <div
          className={`char-counter ${isOverLimit ? 'limit-exceeded' : isNearLimit ? 'limit-near' : ''}`}
          aria-live="polite"
        >
          {currentLength} / {MAX_CHARS}
        </div>
      </div>

      <p id="comment-guidance" className="field-helper">
        Please share specific, actionable feedback on what worked well in this course and what could be improved.
        Remember to avoid including personal identifying details.
      </p>

      <textarea
        id="feedback-comment"
        className="comment-textarea"
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby="comment-guidance comment-error"
        placeholder="e.g., The programming assignments were clear and helpful, but lecture pacing in weeks 3 and 4 felt rushed..."
        maxLength={MAX_CHARS + 200} // slight buffer so user sees limit exceeded if pasted
      />

      {isOverLimit && (
        <div id="comment-error" className="field-error-msg" role="alert">
          Comment exceeds the maximum length of {MAX_CHARS} characters by {currentLength - MAX_CHARS} characters.
        </div>
      )}

      {error && !isOverLimit && (
        <div id="comment-error" className="field-error-msg" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
