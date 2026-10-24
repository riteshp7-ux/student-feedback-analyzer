import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import StudentFeedbackPage from './features/feedback/pages/StudentFeedbackPage';
import LoginPage from './features/auth/LoginPage';
import DashboardPage from './features/dashboard/pages/DashboardPage';

function AppRouter() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Backward compatibility with legacy hash routing (#login, #faculty, #dashboard)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#login' || hash === '#faculty') {
        navigate('/login', { replace: true });
      } else if (hash === '#dashboard') {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="app-loading-screen" role="status">
        <span className="spinner"></span>
        <p>Loading application...</p>
      </div>
    );
  }

  // Only accept known in-app destinations. A query parameter must never
  // redirect an authenticated user to an arbitrary path or external URL.
  const searchParams = new URLSearchParams(location.search);
  const requestedReturnTo = searchParams.get('returnTo');
  const returnToPattern = /^\/dashboard(?:\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})?$/i;
  const returnTo = requestedReturnTo && returnToPattern.test(requestedReturnTo)
    ? requestedReturnTo
    : '/dashboard';

  return (
    <Routes>
      {/* Student Feedback Portal */}
      <Route
        path="/"
        element={
          <StudentFeedbackPage
            onNavigateFaculty={() => navigate('/login')}
          />
        }
      />
      <Route
        path="/student"
        element={
          <StudentFeedbackPage
            onNavigateFaculty={() => navigate('/login')}
          />
        }
      />
      <Route
        path="/student/login"
        element={
          <StudentFeedbackPage
            onNavigateFaculty={() => navigate('/login')}
          />
        }
      />
      <Route
        path="/student/feedback/:courseOfferingId"
        element={
          <StudentFeedbackPage
            onNavigateFaculty={() => navigate('/login')}
          />
        }
      />
      <Route
        path="/feedback"
        element={<Navigate to="/" replace />}
      />

      {/* Faculty Authentication */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to={returnTo} replace />
          ) : (
            <LoginPage
              onLoginSuccess={() => navigate(returnTo, { replace: true })}
              onNavigateHome={() => navigate('/')}
            />
          )
        }
      />

      {/* Faculty Analytics Dashboard (Protected Route) */}
      <Route path="/dashboard" element={<DashboardRoute onNavigateHome={() => navigate('/')} />} />
      <Route path="/dashboard/:offeringId" element={<DashboardRoute onNavigateHome={() => navigate('/')} />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function DashboardRoute({ onNavigateHome }) {
  const { isAuthenticated } = useAuth();
  const { offeringId } = useParams();
  const returnTo = offeringId ? `/dashboard/${offeringId}` : '/dashboard';

  if (!isAuthenticated) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return <DashboardPage initialOfferingId={offeringId || ''} onNavigateHome={onNavigateHome} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}
