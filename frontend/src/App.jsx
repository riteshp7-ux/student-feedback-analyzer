import React, { useState } from 'react';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import StudentFeedbackPage from './features/feedback/pages/StudentFeedbackPage';
import LoginPage from './features/auth/LoginPage';
import DashboardPage from './features/dashboard/pages/DashboardPage';

function AppRouter() {
  const { isAuthenticated, isLoading } = useAuth();
  // View states: 'student' | 'login' | 'dashboard'
  const [currentView, setCurrentView] = useState(() => {
    // If URL hash is #faculty or #login, default there
    if (typeof window !== 'undefined' && (window.location.hash === '#faculty' || window.location.hash === '#login')) {
      return 'login';
    }
    return 'student';
  });

  if (isLoading) {
    return (
      <div className="app-loading-screen" role="status">
        <span className="spinner"></span>
        <p>Loading application...</p>
      </div>
    );
  }

  // If user navigated to faculty section:
  if (currentView === 'faculty' || currentView === 'login' || currentView === 'dashboard') {
    if (isAuthenticated) {
      return (
        <DashboardPage
          onNavigateHome={() => setCurrentView('student')}
        />
      );
    }
    return (
      <LoginPage
        onLoginSuccess={() => setCurrentView('dashboard')}
      />
    );
  }

  // Default: Anonymous Student Submission Flow
  return (
    <StudentFeedbackPage
      onNavigateFaculty={() => setCurrentView('faculty')}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
