import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';

import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import DocsPage from './pages/DocsPage';
import SetupGuidePage from './pages/SetupGuidePage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import DashboardPage from './pages/DashboardPage';
import FeedsPage from './pages/FeedsPage';
import FavoritesPage from './pages/FavoritesPage';
import SettingsPage from './pages/SettingsPage';
import ArticleDetailPage from './pages/ArticleDetailPage';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ArticlesProvider } from './contexts/ArticlesContext';
import { ToastProvider } from './components/ToastContainer';
import ScrollToTop from './components/ScrollToTop';

import './App.css';

// Protected Route wrapper component
const ProtectedRoute = ({ children, user, authLoading }) => {
  if (authLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #FF6B35',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    console.log('Setting up Supabase Auth listener...');

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session ? `Logged in as ${session.user.email}` : 'Not logged in');
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', session ? `Logged in as ${session.user.email}` : 'Not logged in');
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <ThemeProvider>
      <LanguageProvider>
        <ArticlesProvider>
          <ToastProvider>
            <Router>
              <ScrollToTop />
              <div className="App">
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/docs" element={<DocsPage />} />
                  <Route path="/docs/setup" element={<SetupGuidePage />} />
                  <Route path="/privacy" element={<PrivacyPolicyPage />} />
                  <Route
                    path="/login"
                    element={
                      authLoading ? (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          height: '100vh'
                        }}>
                          <div style={{
                            border: '4px solid #f3f3f3',
                            borderTop: '4px solid #FF6B35',
                            borderRadius: '50%',
                            width: '50px',
                            height: '50px',
                            animation: 'spin 1s linear infinite'
                          }}></div>
                        </div>
                      ) : user ? (
                        <Navigate to="/dashboard" replace />
                      ) : (
                        <LoginPage />
                      )
                    }
                  />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute user={user} authLoading={authLoading}>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/feeds"
                  element={
                    <ProtectedRoute user={user} authLoading={authLoading}>
                      <FeedsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/favorites"
                  element={
                    <ProtectedRoute user={user} authLoading={authLoading}>
                      <FavoritesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute user={user} authLoading={authLoading}>
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/article/:id"
                  element={
                    <ProtectedRoute user={user} authLoading={authLoading}>
                      <ArticleDetailPage />
                    </ProtectedRoute>
                  }
                />
                  {/* Fallback for unmatched routes */}
                  <Route path="*" element={<h1>404 Not Found</h1>} />
                </Routes>
              </div>
            </Router>
          </ToastProvider>
        </ArticlesProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
