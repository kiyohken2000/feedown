import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FeedsPage from './pages/FeedsPage';
import FavoritesPage from './pages/FavoritesPage';
import SettingsPage from './pages/SettingsPage';
import ArticleDetailPage from './pages/ArticleDetailPage';
import { ThemeProvider } from './contexts/ThemeContext';

import './App.css'; // Keep existing CSS

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/feeds" element={<FeedsPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/article/:id" element={<ArticleDetailPage />} />
            {/* Fallback for unmatched routes */}
            <Route path="*" element={<h1>404 Not Found</h1>} />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
