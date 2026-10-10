import React, { useState, useEffect } from 'react';
import Header from '../../../shared/components/Header';
import PrivacyNotice from '../components/PrivacyNotice';
import FeedbackForm from '../components/FeedbackForm';
import { fetchCourseOfferings } from '../api/feedbackApi';

export default function StudentFeedbackPage({ onNavigateFaculty }) {
  const [offerings, setOfferings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCourses = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCourseOfferings();
      setOfferings(data);
    } catch (err) {
      setError(err.message || 'Failed to retrieve available course offerings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  return (
    <div className="feedback-page-container">
      <Header onNavigateFaculty={onNavigateFaculty} />
      <main className="feedback-page-main">
        <div className="feedback-card">
          <PrivacyNotice />
          <FeedbackForm
            offerings={offerings}
            isLoadingCourses={isLoading}
            courseError={error}
            onRetryCourses={loadCourses}
          />
        </div>
      </main>
      <footer className="feedback-page-footer">
        <p className="footer-note">
          Student Feedback Analyzer • Minor Project • Anonymous Evaluation Portal
        </p>
      </footer>
    </div>
  );
}
