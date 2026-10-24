import React from 'react';

export default function PrivacyNotice() {
  return (
    <aside className="privacy-notice" aria-labelledby="privacy-heading">
      <div className="privacy-icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
      </div>
      <div className="privacy-content">
        <h2 id="privacy-heading" className="privacy-title">
          Your privacy
        </h2>
        <p className="privacy-body">
          Your feedback is not shown to professors with your student identity. The system uses your account only to verify that you are eligible to submit and that you have not already submitted feedback for this course offering.
        </p>
        <details className="privacy-details">
          <summary className="privacy-summary">How privacy works</summary>
          <div className="privacy-details-content">
            <ul>
              <li><strong>Anonymous Feedback:</strong> Your student identity is used only to verify that you are enrolled and have not yet submitted feedback for this course. Your ratings and comments are stored in an anonymous feedback record that contains no student name, ID, email, or account linkage.</li>
              <li><strong>Submission Control:</strong> A separate submission-control record ensures exactly one submission per student per course offering without linking to your feedback responses.</li>
              <li><strong>Faculty View:</strong> Course instructors view aggregate score summaries and anonymous written comments after the response threshold (N &ge; 5) is met. Submission dates are only ever shown at month granularity, and comment ordering does not reveal exact submission times.</li>
              <li><strong>Level 1 Practical Anonymity:</strong> Instructors cannot identify submitters through normal application APIs. We do not claim cryptographic unlinkability; privileged system database administrators with low-level audit logs could theoretically correlate request timestamps.</li>
              <li><strong>Self-Identification Warning:</strong> Do not include your name, student ID, email, or other identifying information in your written comment.</li>
            </ul>
          </div>
        </details>
      </div>
    </aside>
  );
}
