import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../i18n/translations';
import { getTokens } from '../styles/tokens';
import appStoreBadge from '../assets/images/badges/appstore.png';
import googlePlayBadge from '../assets/images/badges/googleplay.png';

export default function Footer() {
  const { isDarkMode } = useTheme();
  const { language } = useLanguage();
  const t = translations[language].footer;
  const { color, radius } = getTokens(isDarkMode);

  const styles = {
    footer: {
      backgroundColor: color.surface,
      borderTop: `1px solid ${color.border}`,
      padding: '40px 0 20px',
      marginTop: 'auto',
    },
    container: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '0 20px',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '40px',
      marginBottom: '40px',
    },
    column: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    columnTitle: {
      fontSize: '13px',
      fontWeight: 700,
      color: color.text,
      marginBottom: '4px',
      textTransform: 'uppercase',
      letterSpacing: '0.6px',
    },
    link: {
      color: color.textMuted,
      textDecoration: 'none',
      fontSize: '14px',
      transition: 'color 0.2s',
    },
    divider: {
      borderTop: `1px solid ${color.border}`,
      marginBottom: '20px',
    },
    bottom: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '10px',
    },
    copyright: {
      fontSize: '13px',
      color: color.textFaint,
    },
    heart: {
      color: color.accent,
    },
    badges: {
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '5px 10px',
      borderRadius: radius.sm,
      backgroundColor: color.surface2,
      border: `1px solid ${color.border}`,
      color: color.textMuted,
      fontSize: '12px',
      fontWeight: 600,
      textDecoration: 'none',
    },
    storeBadgesContainer: {
      display: 'flex',
      justifyContent: 'center',
      gap: '16px',
      marginBottom: '24px',
    },
    storeBadge: {
      height: '48px',
      width: 'auto',
    },
  };

  const handleLinkHover = (e, enter) => {
    e.currentTarget.style.color = enter ? color.accent : color.textMuted;
  };

  const scrollToTop = () => {
    window.scrollTo(0, 0);
  };

  return (
    <footer style={styles.footer}>
      <div style={styles.container}>
        <div style={styles.grid}>
          <div style={styles.column}>
            <div style={styles.columnTitle}>FeedOwn</div>
            <Link
              to="/"
              style={styles.link}
              onClick={scrollToTop}
              onMouseEnter={(e) => handleLinkHover(e, true)}
              onMouseLeave={(e) => handleLinkHover(e, false)}
            >
              Home
            </Link>
            <Link
              to="/login"
              style={styles.link}
              onClick={scrollToTop}
              onMouseEnter={(e) => handleLinkHover(e, true)}
              onMouseLeave={(e) => handleLinkHover(e, false)}
            >
              Login
            </Link>
            <Link
              to="/privacy"
              style={styles.link}
              onClick={scrollToTop}
              onMouseEnter={(e) => handleLinkHover(e, true)}
              onMouseLeave={(e) => handleLinkHover(e, false)}
            >
              Privacy Policy
            </Link>
          </div>
          <div style={styles.column}>
            <div style={styles.columnTitle}>{t.docs}</div>
            <Link
              to="/docs"
              style={styles.link}
              onClick={scrollToTop}
              onMouseEnter={(e) => handleLinkHover(e, true)}
              onMouseLeave={(e) => handleLinkHover(e, false)}
            >
              Getting Started
            </Link>
            <Link
              to="/docs/setup"
              style={styles.link}
              onClick={scrollToTop}
              onMouseEnter={(e) => handleLinkHover(e, true)}
              onMouseLeave={(e) => handleLinkHover(e, false)}
            >
              Self-Hosting
            </Link>
          </div>
          <div style={styles.column}>
            <div style={styles.columnTitle}>{t.openSource}</div>
            <a
              href="https://github.com/kiyohken2000/feedown"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
              onMouseEnter={(e) => handleLinkHover(e, true)}
              onMouseLeave={(e) => handleLinkHover(e, false)}
            >
              {t.github}
            </a>
            <span style={{ ...styles.link, cursor: 'default' }}>{t.license}</span>
          </div>
        </div>

        <div style={styles.storeBadgesContainer}>
          <a
            href="https://apps.apple.com/us/app/feedown/id6757896656"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src={appStoreBadge} alt="Download on App Store" style={styles.storeBadge} />
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=net.votepurchase.feedown"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src={googlePlayBadge} alt="Get it on Google Play" style={styles.storeBadge} />
          </a>
        </div>

        <div style={styles.divider} />

        <div style={styles.bottom}>
          <div style={styles.copyright}>
            {t.madeWith} <span style={styles.heart}>♥</span> {t.by}{' '}
            <a
              href="https://github.com/kiyohken2000"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: color.accent, textDecoration: 'none' }}
            >
              kiyohken2000
            </a>
          </div>
          <div style={styles.badges}>
            <a
              href="https://github.com/kiyohken2000/feedown"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.badge}
            >
              ⭐ Star on GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
