import React from 'react';

export default function CourseSelector({
  offerings = [],
  selectedId = '',
  onChange,
  isLoading = false,
  error = null,
  onRetry,
}) {
  const selectedOffering = offerings.find((o) => o.id === selectedId);

  return (
    <div className="course-selector-group">
      <label htmlFor="course-select" className="field-label">
        Course Offering <span className="required-indicator" aria-hidden="true">*</span>
      </label>
      <p className="field-helper" id="course-select-helper">
        Select the course and instructor section you are evaluating.
      </p>

      {isLoading ? (
        <div className="selector-loading" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true"></span>
          <span>Loading available courses...</span>
        </div>
      ) : error ? (
        <div className="selector-error" role="alert">
          <p className="error-text">Unable to load courses: {error}</p>
          {onRetry && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onRetry}
            >
              Retry
            </button>
          )}
        </div>
      ) : offerings.length === 0 ? (
        <div className="selector-empty" role="status">
          <p>No active course offerings are currently open for evaluation.</p>
        </div>
      ) : (
        <select
          id="course-select"
          className="select-input"
          value={selectedId}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby="course-select-helper"
          aria-required="true"
        >
          <option value="">-- Choose a course offering --</option>
          {offerings.map((c) => (
            <option key={c.id} value={c.id}>
              {c.courseCode}: {c.courseTitle} — {c.instructorName || c.professorName} ({c.term})
            </option>
          ))}
        </select>
      )}

      {selectedOffering && (
        <div className="selected-course-badge" aria-live="polite">
          <div className="badge-row">
            <span className="course-tag">{selectedOffering.courseCode}</span>
            <span className="course-title-text">{selectedOffering.courseTitle}</span>
          </div>
          <div className="badge-meta">
            <span><strong>Instructor:</strong> {selectedOffering.instructorName || selectedOffering.professorName}</span>
            <span><strong>Term:</strong> {selectedOffering.term}</span>
          </div>
        </div>
      )}
    </div>
  );
}
