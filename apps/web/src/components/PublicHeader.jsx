import { Link, useLocation } from 'react-router-dom';
import { LuSun, LuMoon } from 'react-icons/lu';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../i18n/translations';
import { getTokens } from '../styles/tokens';
import logoIcon from '../assets/images/icon.png';

export default function PublicHeader() {
  const location = useLocation();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { language, setLanguage } = useLanguage();
  const t = translations[language].header;
  const { color, radius, shadow } = getTokens(isDarkMode);

  const isActive = (path) => location.pathname === path;

  const styles = {
    header: {
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backgroundColor: color.surface,
      borderBottom: `1px solid ${color.border}`,
      padding: '12px 0',
      boxShadow: shadow.sm,
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
      width: '30px',
      height: '30px',
      borderRadius: '8px',
    },
    logoText: {
      fontSize: '20px',
      fontWeight: 800,
      letterSpacing: '-0.02em',
      color: color.text,
      textDecoration: 'none',
    },
    nav: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    },
    navLink: {
      padding: '8px 14px',
      borderRadius: radius.sm,
      textDecoration: 'none',
      fontSize: '14px',
      fontWeight: 600,
      color: color.textMuted,
      transition: 'all 0.2s',
    },
    navLinkActive: {
      backgroundColor: color.accentSoft,
      color: color.accent,
    },
    controls: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    langGroup: {
      display: 'inline-flex',
      padding: '2px',
      gap: '2px',
      backgroundColor: color.surface2,
      borderRadius: radius.sm,
      border: `1px solid ${color.border}`,
    },
    langButton: {
      padding: '5px 10px',
      borderRadius: '6px',
      border: 'none',
      backgroundColor: 'transparent',
      color: color.textMuted,
      fontSize: '13px',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    langButtonActive: {
      backgroundColor: color.accent,
      color: color.onAccent,
    },
    themeButton: {
      padding: '7px 9px',
      borderRadius: radius.sm,
      border: `1px solid ${color.border}`,
      backgroundColor: color.surface,
      color: color.text,
      fontSize: '15px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      display: 'flex',
      alignItems: 'center',
    },
    loginButton: {
      padding: '8px 18px',
      borderRadius: radius.sm,
      backgroundColor: color.accent,
      color: color.onAccent,
      textDecoration: 'none',
      fontSize: '14px',
      fontWeight: 600,
      transition: 'all 0.2s',
      boxShadow: shadow.sm,
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
          <div style={styles.langGroup}>
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
          </div>
          <button
            style={styles.themeButton}
            onClick={toggleDarkMode}
            title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
            aria-label={isDarkMode ? 'Light Mode' : 'Dark Mode'}
          >
            {isDarkMode ? <LuSun /> : <LuMoon />}
          </button>
          <Link to="/login" style={styles.loginButton}>
            {t.login}
          </Link>
        </div>
      </div>
    </header>
  );
}
