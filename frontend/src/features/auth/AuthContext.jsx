import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAuthenticatedProfessor, loginProfessor } from '../dashboard/api/dashboardApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [professor, setProfessor] = useState(null);
  const [token, setToken] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);

  // Verifies existing token on mount
  useEffect(() => {
    let isMounted = true;
    async function verifyAuth() {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        if (isMounted) {
          setIsLoading(false);
          setProfessor(null);
        }
        return;
      }

      try {
        const data = await getAuthenticatedProfessor();
        if (isMounted) {
          setProfessor(data.professor);
          setToken(storedToken);
        }
      } catch (err) {
        // Token invalid or expired
        if (isMounted) {
          localStorage.removeItem('token');
          setToken(null);
          setProfessor(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    verifyAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await loginProfessor(email, password);
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setProfessor(data.professor);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setProfessor(null);
  }, []);

  const value = {
    professor,
    token,
    isAuthenticated: Boolean(token && professor),
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
