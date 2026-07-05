import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuLogOut, LuMoon, LuSun, LuTriangleAlert, LuTrash2, LuSmartphone } from 'react-icons/lu';
import { QRCodeSVG } from 'qrcode.react';
import { supabase, getAccessToken } from '../lib/supabase';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';
import Navigation from '../components/Navigation';
import { useTheme } from '../contexts/ThemeContext';
import { useArticles } from '../contexts/ArticlesContext';
import { getTokens } from '../styles/tokens';

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

  const { color, radius, shadow } = getTokens(isDarkMode);
  const WARNING = '#f59e0b';
  const WARNING_HOVER = '#d98806';

  const styles = {
    container: {
      padding: '2rem',
      maxWidth: '800px',
      margin: '0 auto',
      minHeight: '100vh',
    },
    card: {
      backgroundColor: color.surface,
      borderRadius: radius.lg,
      padding: '2rem',
      boxShadow: shadow.sm,
      border: `1px solid ${color.border}`,
      marginBottom: '1.5rem',
    },
    heading: {
      color: color.text,
      margin: '1.5rem 0',
      fontSize: '1.8rem',
      fontWeight: 800,
      letterSpacing: '-0.02em',
    },
    sectionHeading: {
      color: color.text,
      marginBottom: '1rem',
      fontSize: '1.2rem',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    infoRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '0.75rem 0',
      borderBottom: `1px solid ${color.border}`,
      alignItems: 'center',
    },
    label: {
      fontWeight: 600,
      color: color.textMuted,
    },
    value: {
      color: color.text,
    },
    button: {
      padding: '0.7rem 1.75rem',
      backgroundColor: color.accent,
      color: color.onAccent,
      border: 'none',
      borderRadius: radius.sm,
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: 600,
      transition: 'background-color 0.2s',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    secondaryButton: {
      padding: '0.7rem 1.75rem',
      backgroundColor: color.surface,
      color: color.text,
      border: `1px solid ${color.border}`,
      borderRadius: radius.sm,
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: 600,
      transition: 'background-color 0.2s',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    buttonIcon: {
      fontSize: '0.9rem',
    },
    themeIcon: {
      fontSize: '1.2rem',
      marginRight: '0.75rem',
      color: color.accent,
    },
    loadingSpinner: {
      border: `4px solid ${color.surface2}`,
      borderTop: `4px solid ${color.accent}`,
      borderRadius: '50%',
      width: '40px',
      height: '40px',
      animation: 'spin 1s linear infinite',
      margin: '2rem auto',
    },
    toggleSwitch: {
      position: 'relative',
      width: '56px',
      height: '30px',
      backgroundColor: isDarkMode ? color.accent : color.borderStrong,
      borderRadius: radius.pill,
      cursor: 'pointer',
      transition: 'background-color 0.3s',
    },
    toggleSlider: {
      position: 'absolute',
      top: '3px',
      left: isDarkMode ? '29px' : '3px',
      width: '24px',
      height: '24px',
      backgroundColor: 'white',
      borderRadius: '50%',
      transition: 'left 0.3s',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    },
    warningText: {
      color: WARNING,
      fontSize: '0.9rem',
      marginBottom: '1.5rem',
      fontWeight: 600,
    },
    dangerSection: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
    },
    dangerItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1.25rem',
      borderRadius: radius.md,
      border: `1px solid ${color.border}`,
      gap: '1rem',
    },
    dangerTitle: {
      fontSize: '1.05rem',
      fontWeight: 700,
      color: color.text,
      marginBottom: '0.4rem',
    },
    dangerDescription: {
      fontSize: '0.9rem',
      color: color.textMuted,
      lineHeight: '1.5',
    },
    warningButton: {
      backgroundColor: WARNING,
      flexShrink: 0,
    },
    criticalButton: {
      backgroundColor: color.danger,
      flexShrink: 0,
    },
    passwordHint: {
      fontSize: '0.85rem',
      color: color.textFaint,
      marginTop: '1rem',
      fontStyle: 'italic',
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
            <span style={{ ...styles.label, display: 'flex', alignItems: 'center' }}>
              {isDarkMode ? <LuMoon style={styles.themeIcon} /> : <LuSun style={styles.themeIcon} />}
              Dark Mode
            </span>
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
          <p style={styles.passwordHint}>
            If you didn't set a custom password, the default password is 111111
          </p>
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionHeading}>
            <LuSmartphone style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Mobile Login
          </h2>
          <p style={{ color: color.textMuted, marginBottom: '1rem', lineHeight: '1.5' }}>
            Scan this QR code with the FeedOwn mobile app to auto-fill your server URL and email.
          </p>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              display: 'inline-block',
              padding: '16px',
              backgroundColor: isDarkMode ? '#ffffff' : '#ffffff',
              borderRadius: '12px',
            }}>
              <QRCodeSVG
                value={JSON.stringify({
                  server: window.location.origin,
                  email: user?.email || ''
                })}
                size={200}
                bgColor="#ffffff"
                fgColor="#000000"
                level="M"
              />
            </div>
          </div>
          <p style={{ color: color.textFaint, fontSize: '0.9rem', textAlign: 'center', fontStyle: 'italic' }}>
            After scanning, enter your password to complete login.
          </p>
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionHeading}>Actions</h2>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={handleLogout}
              style={styles.secondaryButton}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = color.surfaceHover)}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = color.surface)}
            >
              <LuLogOut style={styles.buttonIcon} />
              Logout
            </button>
          </div>
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
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = WARNING_HOVER)}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = WARNING)}
              >
                <LuTriangleAlert style={styles.buttonIcon} />
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
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#b02a37')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = color.danger)}
              >
                <LuTrash2 style={styles.buttonIcon} />
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
