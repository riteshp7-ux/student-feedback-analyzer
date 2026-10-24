import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import Header from '../../../shared/components/Header';
import PrivacyNotice from '../components/PrivacyNotice';
import FeedbackForm from '../components/FeedbackForm';
import StudentAuthCard from '../components/StudentAuthCard';
import StudentBar from '../components/StudentBar';
import { fetchStudentMe, fetchStudentOfferings } from '../api/feedbackApi';

export default function StudentFeedbackPage({ onNavigateFaculty }) {
  const [searchParams] = useSearchParams();
  const routeParams = useParams();
  const initialOfferingId = routeParams.courseOfferingId || routeParams.offeringId || searchParams.get('offeringId') || '';
  const [student, setStudent] = useState(null);
  const [offerings, setOfferings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStudentAndOfferings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const token = typeof window !== 'undefined' ? localStorage.getItem('student_token') : null;

    if (!token) {
      setStudent(null);
      setOfferings([]);
      setIsLoading(false);
      return;
    }

    try {
      const meRes = await fetchStudentMe();
      setStudent(meRes.student);

      const offeringsRes = await fetchStudentOfferings();
      const rawOfferings = offeringsRes.offerings || [];
      const normalizedOfferings = rawOfferings.map((o) => ({
        ...o,
        id: o.offeringId || o.id,
      }));
      setOfferings(normalizedOfferings);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        localStorage.removeItem('student_token');
        setStudent(null);
        setOfferings([]);
      } else {
        setError(err.message || 'Failed to load student course enrollments.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudentAndOfferings();
  }, [loadStudentAndOfferings]);

  const handleSignOut = () => {
    localStorage.removeItem('student_token');
    setStudent(null);
    setOfferings([]);
  };

  const handleLoginSuccess = (authenticatedStudent) => {
    setStudent(authenticatedStudent);
    loadStudentAndOfferings();
  };

  return (
    <div className="feedback-page-container">
      <Header onNavigateFaculty={onNavigateFaculty} />
      <main className="feedback-page-main">
        <div className="feedback-card">
          <PrivacyNotice />

          {student ? (
            <>
              <StudentBar student={student} onSignOut={handleSignOut} />
              <FeedbackForm
                student={student}
                offerings={offerings}
                isLoadingCourses={isLoading}
                courseError={error}
                onRetryCourses={loadStudentAndOfferings}
                onFeedbackSubmitted={loadStudentAndOfferings}
                initialOfferingId={initialOfferingId}
              />
            </>
          ) : (
            <StudentAuthCard onLoginSuccess={handleLoginSuccess} />
          )}
        </div>
      </main>
      <footer className="feedback-page-footer">
        <p className="footer-note">
          Student Feedback Analyzer • Minor Project • Anonymous Evaluation Portal (Level 1 Practical Anonymity)
        </p>
      </footer>
    </div>
  );
}
