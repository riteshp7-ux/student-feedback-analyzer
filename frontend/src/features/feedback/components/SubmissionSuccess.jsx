import React from 'react';

export default function SubmissionSuccess({
  feedbackId,
  courseOffering,
  onReset,
}) {
  return (
    <div className="submission-success-card" role="status" aria-live="polite">
      <div className="success-icon-wrapper" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h2 className="success-title">Feedback Submitted Successfully</h2>
      
      <p className="success-message">
        Thank you for submitting your evaluation. Your ratings and comments have been recorded anonymously and will help improve future course instruction.
      </p>

      {courseOffering && (
        <div className="submitted-course-summary">
          <span className="summary-label">Evaluated Course:</span>
          <span className="summary-value">
            {courseOffering.courseCode}: {courseOffering.courseTitle} ({courseOffering.professorName})
          </span>
        </div>
      )}

      {feedbackId && (
        <div className="submission-receipt">
          <span className="receipt-label">Submission ID:</span>
          <code className="receipt-code mono">{feedbackId}</code>
        </div>
      )}

      <div className="success-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onReset}
        >
          Submit Feedback for Another Course
        </button>
      </div>
    </div>
  );
}
