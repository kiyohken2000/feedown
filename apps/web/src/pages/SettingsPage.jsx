import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSignOutAlt, FaMoon, FaSun, FaExclamationTriangle, FaTrash, FaMobileAlt, FaDesktop } from 'react-icons/fa';
import { QRCodeSVG } from 'qrcode.react';
import { supabase, getAccessToken } from '../lib/supabase';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';
import Navigation from '../components/Navigation';
import { useTheme } from '../contexts/ThemeContext';
import { useArticles } from '../contexts/ArticlesContext';

const SettingsPage = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const { isDarkMode, themeMode, setTheme } = useTheme();
  const { clearAllData: clearArticlesContext } = useArticles();

  const apiClient = useMemo(() => createApiClient(
    import.meta.env.VITE_API_BASE_URL || '',
    getAccessToken
  ), []);
  const api = useMemo(() => new FeedOwnAPI(apiClient), [apiClient]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/');
      else { setUser(session.user); setLoading(false); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate('/');
      else { setUser(session.user); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      clearArticlesContext();
      await supabase.auth.signOut();
      navigate('/');
    } catch (error) {
      alert('Failed to logout: ' + error.message);
    }
  };

  const handleClearAllData = async () => {
    if (!window.confirm('This will delete all your data (feeds, articles, favorites). This action cannot be undone.\n\nAre you sure?')) return;
    if (!window.confirm('Are you absolutely sure? All your data will be permanently deleted.')) return;
    try {
      const response = await api.user.clearAllData();
      if (response.success) {
        clearArticlesContext();
        alert('All data has been deleted successfully.');
        window.location.href = '/dashboard';
      } else {
        alert('Failed to delete data: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Failed to delete data: ' + error.message);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('This will permanently delete your account and all associated data.\n\nAre you sure?')) return;
    if (!window.confirm('Are you absolutely sure? Your account will be permanently deleted.')) return;
    try {
      const response = await api.user.deleteAccount();
      if (response.success) {
        clearArticlesContext();
        await supabase.auth.signOut();
        navigate('/');
      } else {
        alert('Failed to delete account: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Failed to delete account: ' + error.message);
    }
  };

  const bg = isDarkMode ? '#1a1a1a' : '#f5f5f5';
  const cardBg = isDarkMode ? '#2d2d2d' : 'white';
  const textPrimary = isDarkMode ? '#e0e0e0' : '#333';
  const textSecondary = isDarkMode ? '#999' : '#666';
  const border = isDarkMode ? '#444' : '#eee';

  const styles = {
    container: { padding: '2rem', maxWidth: '800px', margin: '2rem auto', backgroundColor: bg, minHeight: '100vh' },
    card: { backgroundColor: cardBg, borderRadius: '8px', padding: '2rem', boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '2rem' },
    heading: { color: textPrimary, marginBottom: '1.5rem', fontSize: '1.8rem', fontWeight: 'bold' },
    sectionHeading: { color: isDarkMode ? '#b0b0b0' : '#555', marginBottom: '1rem', fontSize: '1.3rem', fontWeight: '600' },
    infoRow: { display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: `1px solid ${border}`, alignItems: 'center' },
    label: { fontWeight: '600', color: textSecondary },
    value: { color: textPrimary },
    button: { padding: '0.75rem 2rem', backgroundColor: '#FF6B35', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' },
    dangerButton: { backgroundColor: '#dc3545' },
    warningButton: { backgroundColor: '#ff9800', flexShrink: 0 },
    criticalButton: { backgroundColor: '#c82333', flexShrink: 0 },
    loadingSpinner: { border: '4px solid #f3f3f3', borderTop: '4px solid #FF6B35', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '2rem auto' },
    dangerSection: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
    dangerItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderRadius: '5px', border: `1px solid ${border}`, gap: '1rem' },
    dangerTitle: { fontSize: '1.1rem', fontWeight: '600', color: textPrimary, marginBottom: '0.5rem' },
    dangerDescription: { fontSize: '0.9rem', color: isDarkMode ? '#b0b0b0' : '#666', lineHeight: '1.4' },
    warningText: { color: isDarkMode ? '#ff9800' : '#ff6f00', fontSize: '0.9rem', marginBottom: '1.5rem', fontWeight: '500' },
    passwordHint: { fontSize: '0.85rem', color: '#888', marginTop: '1rem', fontStyle: 'italic' },
  };

  // テーマ選択ボタン
  const themeOptions = [
    { mode: 'light', label: 'ライト', icon: <FaSun /> },
    { mode: 'dark', label: 'ダーク', icon: <FaMoon /> },
    { mode: 'system', label: 'システム', icon: <FaDesktop /> },
  ];

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

        {/* Appearance */}
        <div style={styles.card}>
          <h2 style={styles.sectionHeading}>Appearance</h2>
          <div style={styles.infoRow}>
            <span style={{ ...styles.label, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isDarkMode ? <FaMoon style={{ color: '#ffc107' }} /> : <FaSun style={{ color: '#FF6B35' }} />}
              テーマ
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {themeOptions.map(opt => (
                <button
                  key={opt.mode}
                  onClick={() => setTheme(opt.mode)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.45rem 0.9rem',
                    borderRadius: '20px',
                    border: `2px solid ${themeMode === opt.mode ? '#FF6B35' : border}`,
                    backgroundColor: themeMode === opt.mode ? '#FF6B35' : 'transparent',
                    color: themeMode === opt.mode ? 'white' : textSecondary,
                    cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600',
                    transition: 'all 0.2s',
                  }}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div style={styles.card}>
          <h2 style={styles.sectionHeading}>Account Information</h2>
          <div style={styles.infoRow}>
            <span style={styles.label}>Email:</span>
            <span style={styles.value}>{user?.email}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Account Created:</span>
            <span style={styles.value}>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</span>
          </div>
          <p style={styles.passwordHint}>
            If you didn't set a custom password, the default password is 111111
          </p>
        </div>

        {/* Mobile Login QR */}
        <div style={styles.card}>
          <h2 style={styles.sectionHeading}>
            <FaMobileAlt style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Mobile Login
          </h2>
          <p style={{ color: isDarkMode ? '#b0b0b0' : '#666', marginBottom: '1rem', lineHeight: '1.5' }}>
            Scan this QR code with the FeedOwn mobile app to auto-fill your server URL and email.
          </p>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ display: 'inline-block', padding: '16px', backgroundColor: '#ffffff', borderRadius: '12px' }}>
              <QRCodeSVG
                value={JSON.stringify({ server: window.location.origin, email: user?.email || '' })}
                size={200} bgColor="#ffffff" fgColor="#000000" level="M"
              />
            </div>
          </div>
          <p style={{ color: '#888', fontSize: '0.9rem', textAlign: 'center', fontStyle: 'italic' }}>
            After scanning, enter your password to complete login.
          </p>
        </div>

        {/* Actions */}
        <div style={styles.card}>
          <h2 style={styles.sectionHeading}>Actions</h2>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={handleLogout} style={{ ...styles.button, ...styles.dangerButton }}>
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div style={styles.card}>
          <h2 style={styles.sectionHeading}>Danger Zone</h2>
          <p style={styles.warningText}>These actions are irreversible. Please proceed with caution.</p>
          <div style={styles.dangerSection}>
            <div style={styles.dangerItem}>
              <div>
                <h3 style={styles.dangerTitle}>Clear All Data</h3>
                <p style={styles.dangerDescription}>Delete all feeds, articles, and favorites. Your account will remain active.</p>
              </div>
              <button onClick={handleClearAllData} style={{ ...styles.button, ...styles.warningButton }}>
                <FaExclamationTriangle /> Clear Data
              </button>
            </div>
            <div style={styles.dangerItem}>
              <div>
                <h3 style={styles.dangerTitle}>Delete Account</h3>
                <p style={styles.dangerDescription}>Permanently delete your account and all data.</p>
              </div>
              <button onClick={handleDeleteAccount} style={{ ...styles.button, ...styles.criticalButton }}>
                <FaTrash /> Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
