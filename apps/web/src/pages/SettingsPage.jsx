import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, getAccessToken } from '../lib/supabase';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';
import Navigation from '../components/Navigation';
import { useTheme } from '../contexts/ThemeContext';
import { useArticles } from '../contexts/ArticlesContext';

const SettingsPage = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { clearAllData: clearArticlesContext } = useArticles();

  const apiClient = useMemo(() => createApiClient(
    import.meta.env.VITE_API_BASE_URL || '',
    getAccessToken
  ), []);

  const api = useMemo(() => new FeedOwnAPI(apiClient), [apiClient]);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/');
      } else {
        setUser(session.user);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/');
      } else {
        setUser(session.user);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      // Clear global articles context before logout
      clearArticlesContext();
      await supabase.auth.signOut();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
      alert('Failed to logout: ' + error.message);
    }
  };

  const handleClearAllData = async () => {
    const confirmed = window.confirm(
      'This will delete all your data (feeds, articles, favorites). This action cannot be undone. Your account will remain active.\n\nAre you sure you want to continue?'
    );

    if (!confirmed) return;

    const doubleConfirmed = window.confirm(
      'Are you absolutely sure? All your data will be permanently deleted.'
    );

    if (!doubleConfirmed) return;

    try {
      const response = await api.user.clearAllData();
      console.log('Clear data response:', response);
      if (response.success) {
        // Clear global articles context
        clearArticlesContext();
        alert('All data has been deleted successfully.');
        // Force a full page reload to clear all state and show empty dashboard
        window.location.href = '/dashboard';
      } else {
        alert('Failed to delete data: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Clear data failed:', error);
      alert('Failed to delete data: ' + error.message);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'This will permanently delete your account and all associated data. This action cannot be undone.\n\nAre you sure you want to continue?'
    );

    if (!confirmed) return;

    const doubleConfirmed = window.confirm(
      'Are you absolutely sure? Your account and all data will be permanently deleted and you will not be able to log in again.'
    );

    if (!doubleConfirmed) return;

    try {
      const response = await api.user.deleteAccount();
      if (response.success) {
        // Clear global articles context
        clearArticlesContext();
        alert('Your account has been deleted successfully.');
        // Sign out and redirect to login
        await supabase.auth.signOut();
        navigate('/');
      } else {
        alert('Failed to delete account: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Delete account failed:', error);
      alert('Failed to delete account: ' + (error.message || error.toString()));
    }
  };

  const styles = {
    container: {
      padding: '2rem',
      maxWidth: '800px',
      margin: '2rem auto',
      backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
      minHeight: '100vh',
    },
    card: {
      backgroundColor: isDarkMode ? '#2d2d2d' : 'white',
      borderRadius: '8px',
      padding: '2rem',
      boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.1)',
      marginBottom: '2rem',
    },
    heading: {
      color: isDarkMode ? '#e0e0e0' : '#333',
      marginBottom: '1.5rem',
      fontSize: '1.8rem',
      fontWeight: 'bold',
    },
    sectionHeading: {
      color: isDarkMode ? '#b0b0b0' : '#555',
      marginBottom: '1rem',
      fontSize: '1.3rem',
      fontWeight: '600',
    },
    infoRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '0.75rem 0',
      borderBottom: isDarkMode ? '1px solid #444' : '1px solid #eee',
      alignItems: 'center',
    },
    label: {
      fontWeight: '600',
      color: isDarkMode ? '#999' : '#666',
    },
    value: {
      color: isDarkMode ? '#e0e0e0' : '#333',
    },
    button: {
      padding: '0.75rem 2rem',
      backgroundColor: '#FF6B35',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: '600',
      transition: 'background-color 0.3s',
    },
    dangerButton: {
      backgroundColor: '#dc3545',
    },
    loadingSpinner: {
      border: '4px solid #f3f3f3',
      borderTop: '4px solid #FF6B35',
      borderRadius: '50%',
      width: '40px',
      height: '40px',
      animation: 'spin 1s linear infinite',
      margin: '2rem auto',
    },
    toggleSwitch: {
      position: 'relative',
      width: '60px',
      height: '30px',
      backgroundColor: isDarkMode ? '#FF6B35' : '#ccc',
      borderRadius: '15px',
      cursor: 'pointer',
      transition: 'background-color 0.3s',
    },
    toggleSlider: {
      position: 'absolute',
      top: '3px',
      left: isDarkMode ? '33px' : '3px',
      width: '24px',
      height: '24px',
      backgroundColor: 'white',
      borderRadius: '50%',
      transition: 'left 0.3s',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    },
    warningText: {
      color: isDarkMode ? '#ff9800' : '#ff6f00',
      fontSize: '0.9rem',
      marginBottom: '1.5rem',
      fontWeight: '500',
    },
    dangerSection: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
    },
    dangerItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem',
      borderRadius: '5px',
      border: isDarkMode ? '1px solid #444' : '1px solid #e0e0e0',
      gap: '1rem',
    },
    dangerTitle: {
      fontSize: '1.1rem',
      fontWeight: '600',
      color: isDarkMode ? '#e0e0e0' : '#333',
      marginBottom: '0.5rem',
    },
    dangerDescription: {
      fontSize: '0.9rem',
      color: isDarkMode ? '#b0b0b0' : '#666',
      lineHeight: '1.4',
    },
    warningButton: {
      backgroundColor: '#ff9800',
      flexShrink: 0,
    },
    criticalButton: {
      backgroundColor: '#c82333',
      flexShrink: 0,
    },
  };

  if (loading) {
    return (
      <div>
        <Navigation />
        <div style={styles.container}>
          <div style={styles.loadingSpinner}></div>
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation />
      <div style={styles.container}>
        <h1 style={styles.heading}>Settings</h1>

        <div style={styles.card}>
          <h2 style={styles.sectionHeading}>Appearance</h2>
          <div style={styles.infoRow}>
            <span style={styles.label}>Dark Mode</span>
            <div
              style={styles.toggleSwitch}
              onClick={toggleDarkMode}
            >
              <div style={styles.toggleSlider}></div>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionHeading}>Account Information</h2>
          <div style={styles.infoRow}>
            <span style={styles.label}>Email:</span>
            <span style={styles.value}>{user?.email}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Account Created:</span>
            <span style={styles.value}>
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionHeading}>Actions</h2>
          <button
            onClick={handleLogout}
            style={{ ...styles.button, ...styles.dangerButton }}
            onMouseOver={(e) => (e.target.style.backgroundColor = '#c82333')}
            onMouseOut={(e) => (e.target.style.backgroundColor = '#dc3545')}
          >
            Logout
          </button>
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionHeading}>Danger Zone</h2>
          <p style={styles.warningText}>These actions are irreversible. Please proceed with caution.</p>

          <div style={styles.dangerSection}>
            <div style={styles.dangerItem}>
              <div>
                <h3 style={styles.dangerTitle}>Clear All Data</h3>
                <p style={styles.dangerDescription}>
                  Delete all feeds, articles, and favorites. Your account will remain active.
                </p>
              </div>
              <button
                onClick={handleClearAllData}
                style={{ ...styles.button, ...styles.warningButton }}
                onMouseOver={(e) => (e.target.style.backgroundColor = '#e68900')}
                onMouseOut={(e) => (e.target.style.backgroundColor = '#ff9800')}
              >
                Clear Data
              </button>
            </div>

            <div style={styles.dangerItem}>
              <div>
                <h3 style={styles.dangerTitle}>Delete Account</h3>
                <p style={styles.dangerDescription}>
                  Permanently delete your account and all data. You will not be able to log in again.
                </p>
              </div>
              <button
                onClick={handleDeleteAccount}
                style={{ ...styles.button, ...styles.criticalButton }}
                onMouseOver={(e) => (e.target.style.backgroundColor = '#a00000')}
                onMouseOut={(e) => (e.target.style.backgroundColor = '#c82333')}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
