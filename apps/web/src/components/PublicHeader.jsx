import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../i18n/translations';
import logoIcon from '../assets/images/icon.png';

export default function PublicHeader() {
  const location = useLocation();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { language, setLanguage } = useLanguage();
  const t = translations[language].header;

  const isActive = (path) => location.pathname === path;

  const styles = {
    header: {
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
      borderBottom: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
      padding: '12px 0',
    },
    container: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '0 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    logoSection: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      textDecoration: 'none',
    },
    logo: {
      width: '32px',
      height: '32px',
    },
    logoText: {
      fontSize: '20px',
      fontWeight: 'bold',
      color: '#FF6B35',
      textDecoration: 'none',
    },
    nav: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    navLink: {
      padding: '8px 16px',
      borderRadius: '8px',
      textDecoration: 'none',
      fontSize: '14px',
      fontWeight: '500',
      color: isDarkMode ? '#e0e0e0' : '#333',
      transition: 'all 0.2s',
    },
    navLinkActive: {
      backgroundColor: isDarkMode ? '#333' : '#f0f0f0',
      color: '#FF6B35',
    },
    controls: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    langButton: {
      padding: '6px 12px',
      borderRadius: '6px',
      border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`,
      backgroundColor: 'transparent',
      color: isDarkMode ? '#e0e0e0' : '#333',
      fontSize: '13px',
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    langButtonActive: {
      backgroundColor: '#FF6B35',
      borderColor: '#FF6B35',
      color: '#fff',
    },
    themeButton: {
      padding: '6px 10px',
      borderRadius: '6px',
      border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`,
      backgroundColor: 'transparent',
      color: isDarkMode ? '#e0e0e0' : '#333',
      fontSize: '16px',
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    loginButton: {
      padding: '8px 20px',
      borderRadius: '8px',
      backgroundColor: '#FF6B35',
      color: '#fff',
      textDecoration: 'none',
      fontSize: '14px',
      fontWeight: '500',
      transition: 'all 0.2s',
    },
    mobileNav: {
      display: 'none',
    },
  };

  return (
    <header style={styles.header}>
      <div style={styles.container}>
        <Link to="/" style={styles.logoSection}>
          <img src={logoIcon} alt="FeedOwn" style={styles.logo} />
          <span style={styles.logoText}>FeedOwn</span>
        </Link>

        <nav style={styles.nav}>
          <Link
            to="/"
            style={{
              ...styles.navLink,
              ...(isActive('/') ? styles.navLinkActive : {}),
            }}
          >
            {t.home}
          </Link>
          <Link
            to="/docs"
            style={{
              ...styles.navLink,
              ...(isActive('/docs') ? styles.navLinkActive : {}),
            }}
          >
            {t.docs}
          </Link>
          <Link
            to="/docs/setup"
            style={{
              ...styles.navLink,
              ...(isActive('/docs/setup') ? styles.navLinkActive : {}),
            }}
          >
            {t.setup}
          </Link>
        </nav>

        <div style={styles.controls}>
          <button
            style={{
              ...styles.langButton,
              ...(language === 'en' ? styles.langButtonActive : {}),
            }}
            onClick={() => setLanguage('en')}
          >
            EN
          </button>
          <button
            style={{
              ...styles.langButton,
              ...(language === 'ja' ? styles.langButtonActive : {}),
            }}
            onClick={() => setLanguage('ja')}
          >
            JA
          </button>
          <button
            style={styles.themeButton}
            onClick={toggleDarkMode}
            title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          <Link to="/login" style={styles.loginButton}>
            {t.login}
          </Link>
        </div>
      </div>
    </header>
  );
}
