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
          100% Anonymous Feedback Guarantee
        </h2>
        <p className="privacy-body">
          Your submission is confidential. We do <strong>not</strong> track, collect, or store your student ID, name, email, IP address, or browser fingerprint with this feedback.
        </p>
        <p className="privacy-subtext">
          Ratings and feedback comments are delivered to course faculty strictly in aggregated and anonymized form to uphold academic integrity.
        </p>
      </div>
    </aside>
  );
}
