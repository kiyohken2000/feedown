import React, { useEffect, useState, useMemo } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';
import Navigation from '../components/Navigation';
import { useTheme } from '../contexts/ThemeContext';

const SettingsPage = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const auth = getAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();

  const apiClient = useMemo(() => createApiClient(
    import.meta.env.VITE_API_BASE_URL || '/api',
    async () => auth.currentUser ? auth.currentUser.getIdToken() : null
  ), [auth]);

  const api = useMemo(() => new FeedOwnAPI(apiClient), [apiClient]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        navigate('/');
      } else {
        setUser(currentUser);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth, navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
      alert('Failed to logout: ' + error.message);
    }
  };

  const handleClearAllData = async () => {
    const confirmed = window.confirm(
      'すべてのデータ（フィード、記事、お気に入り）を削除します。この操作は取り消せません。アカウントは残ります。\n\n本当に削除しますか？'
    );

    if (!confirmed) return;

    const doubleConfirmed = window.confirm(
      '本当によろしいですか？すべてのデータが完全に削除されます。'
    );

    if (!doubleConfirmed) return;

    try {
      const response = await api.user.clearAllData();
      if (response.success) {
        alert('すべてのデータを削除しました。');
        // Redirect to dashboard to see empty state
        navigate('/dashboard');
      } else {
        alert('データの削除に失敗しました: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Clear data failed:', error);
      alert('データの削除に失敗しました: ' + error.message);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'アカウントとすべてのデータを完全に削除します。この操作は取り消せません。\n\n本当に削除しますか？'
    );

    if (!confirmed) return;

    const doubleConfirmed = window.confirm(
      '本当によろしいですか？アカウントとすべてのデータが完全に削除され、ログインできなくなります。'
    );

    if (!doubleConfirmed) return;

    try {
      const response = await api.user.deleteAccount();
      if (response.success) {
        alert('アカウントを削除しました。');
        // Sign out and redirect to login
        await signOut(auth);
        navigate('/');
      } else {
        alert('アカウントの削除に失敗しました: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Delete account failed:', error);
      alert('アカウントの削除に失敗しました: ' + error.message);
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
              {user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : 'N/A'}
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
          <p style={styles.warningText}>これらの操作は取り消せません。注意して実行してください。</p>

          <div style={styles.dangerSection}>
            <div style={styles.dangerItem}>
              <div>
                <h3 style={styles.dangerTitle}>すべてのデータを削除</h3>
                <p style={styles.dangerDescription}>
                  フィード、記事、お気に入りをすべて削除します。アカウントは残ります。
                </p>
              </div>
              <button
                onClick={handleClearAllData}
                style={{ ...styles.button, ...styles.warningButton }}
                onMouseOver={(e) => (e.target.style.backgroundColor = '#e68900')}
                onMouseOut={(e) => (e.target.style.backgroundColor = '#ff9800')}
              >
                データを削除
              </button>
            </div>

            <div style={styles.dangerItem}>
              <div>
                <h3 style={styles.dangerTitle}>アカウントを削除</h3>
                <p style={styles.dangerDescription}>
                  アカウントとすべてのデータを完全に削除します。二度とログインできなくなります。
                </p>
              </div>
              <button
                onClick={handleDeleteAccount}
                style={{ ...styles.button, ...styles.criticalButton }}
                onMouseOver={(e) => (e.target.style.backgroundColor = '#a00000')}
                onMouseOut={(e) => (e.target.style.backgroundColor = '#c82333')}
              >
                アカウント削除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
