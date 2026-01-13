import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FeedsPage from './pages/FeedsPage';
import FavoritesPage from './pages/FavoritesPage';
import SettingsPage from './pages/SettingsPage';
import ArticleDetailPage from './pages/ArticleDetailPage';
import { ThemeProvider } from './contexts/ThemeContext';
import { ArticlesProvider } from './contexts/ArticlesContext';
import { ToastProvider } from './components/ToastContainer';

import './App.css'; // Keep existing CSS

// Protected Route wrapper component
const ProtectedRoute = ({ children, user, authLoading }) => {
  if (authLoading) {
    // Show loading spinner while checking auth state
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
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    console.log('Setting up Firebase Auth listener...');
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('Auth state changed:', currentUser ? `Logged in as ${currentUser.email}` : 'Not logged in');
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  return (
    <ThemeProvider>
      <ArticlesProvider>
        <ToastProvider>
          <Router>
            <div className="App">
              <Routes>
                <Route
                  path="/"
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
    </ThemeProvider>
  );
}

export default App;
