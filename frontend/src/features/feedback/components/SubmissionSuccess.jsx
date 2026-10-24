import React from 'react';

export default function SubmissionSuccess({
  feedbackId,
  courseOffering,
  commentPending = false,
  onReset,
}) {
  const hasValidFeedbackId = feedbackId && feedbackId !== 'SUBMISSION_RECORDED';

  return (
    <div className="submission-success-card" role="status" aria-live="polite">
      <div className="success-icon-wrapper" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h2 className="success-title">Feedback Submitted Successfully</h2>
      
      <p className="success-message">
        Your feedback has been successfully received. The evaluation is final and cannot be edited or resubmitted. Professors view evaluations without your student identity.
      </p>

      {courseOffering && (
        <div className="submitted-course-summary">
          <span className="summary-label">Evaluated Course:</span>
          <span className="summary-value">
            {courseOffering.courseCode}: {courseOffering.courseTitle} ({courseOffering.professorName})
          </span>
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
