import React from 'react';

export default function CourseSelector({
  offerings = [],
  selectedId = '',
  onChange,
  isLoading = false,
  error = null,
  onRetry,
}) {
  const selectedOffering = offerings.find((offering) => offering.id === selectedId);

  return (
    <div className="course-selector-group">
      <label htmlFor="course-select" className="field-label">
        Course <span className="required-indicator" aria-hidden="true">*</span>
      </label>
      <p className="field-helper" id="course-select-helper">
        Choose one of the courses assigned to you.
      </p>

      {isLoading ? (
        <div className="selector-loading" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true"></span>
          <span>Loading your courses...</span>
        </div>
      ) : error ? (
        <div className="selector-error" role="alert">
          <p className="error-text">Unable to load your courses: {error}</p>
          {onRetry && <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>Retry</button>}
        </div>
      ) : offerings.length === 0 ? (
        <div className="selector-empty" role="status">
          <p>No courses are currently assigned to your account for feedback.</p>
        </div>
      ) : (
        <select
          id="course-select"
          className="select-input"
          value={selectedId}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby="course-select-helper"
          aria-required="true"
        >
          <option value="">Choose a course</option>
          {offerings.map((offering) => (
            <option key={offering.id} value={offering.id}>
              {offering.courseCode}: {offering.courseTitle}
              {offering.hasSubmitted ? ' · Feedback submitted' : ''}
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
            <span><strong>Professor:</strong> {selectedOffering.instructorName || selectedOffering.professorName}</span>
            {selectedOffering.departmentName && (
              <span><strong>Department:</strong> {selectedOffering.departmentName}</span>
            )}
            {selectedOffering.hasSubmitted && <span><strong>Status:</strong> Feedback submitted</span>}
          </div>
        </div>
      )}
    </div>
  );
}
