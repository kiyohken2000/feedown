import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../i18n/translations';
import PublicHeader from '../components/PublicHeader';
import Footer from '../components/Footer';
import screenshotImage from '../assets/images/screenshot_1.png';

export default function LandingPage() {
  const { isDarkMode } = useTheme();
  const { language } = useLanguage();
  const t = translations[language].landing;

  const styles = {
    page: {
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: isDarkMode ? '#121212' : '#ffffff',
      color: isDarkMode ? '#e0e0e0' : '#333',
    },
    // Hero Section
    hero: {
      padding: '80px 20px',
      textAlign: 'center',
      background: isDarkMode
        ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
        : 'linear-gradient(135deg, #fff5f2 0%, #ffffff 100%)',
    },
    heroContent: {
      maxWidth: '800px',
      margin: '0 auto',
    },
    tagline: {
      fontSize: 'clamp(32px, 5vw, 56px)',
      fontWeight: '800',
      marginBottom: '20px',
      background: 'linear-gradient(135deg, #FF6B35 0%, #f7931e 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    },
    description: {
      fontSize: '18px',
      lineHeight: '1.6',
      color: isDarkMode ? '#b0b0b0' : '#666',
      marginBottom: '40px',
      maxWidth: '600px',
      margin: '0 auto 40px',
    },
    heroButtons: {
      display: 'flex',
      gap: '16px',
      justifyContent: 'center',
      flexWrap: 'wrap',
    },
    primaryButton: {
      padding: '14px 32px',
      borderRadius: '10px',
      backgroundColor: '#FF6B35',
      color: '#fff',
      textDecoration: 'none',
      fontSize: '16px',
      fontWeight: '600',
      transition: 'all 0.2s',
      boxShadow: '0 4px 14px rgba(255, 107, 53, 0.3)',
    },
    secondaryButton: {
      padding: '14px 32px',
      borderRadius: '10px',
      backgroundColor: 'transparent',
      color: '#FF6B35',
      textDecoration: 'none',
      fontSize: '16px',
      fontWeight: '600',
      border: '2px solid #FF6B35',
      transition: 'all 0.2s',
    },
    // Features Section
    features: {
      padding: '80px 20px',
      backgroundColor: isDarkMode ? '#1a1a1a' : '#f8f9fa',
    },
    sectionTitle: {
      fontSize: '32px',
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: '12px',
      color: isDarkMode ? '#e0e0e0' : '#333',
    },
    sectionSubtitle: {
      fontSize: '16px',
      textAlign: 'center',
      color: isDarkMode ? '#888' : '#666',
      marginBottom: '60px',
    },
    featuresGrid: {
      maxWidth: '1000px',
      margin: '0 auto',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '30px',
    },
    featureCard: {
      padding: '30px',
      borderRadius: '16px',
      backgroundColor: isDarkMode ? '#2d2d2d' : '#ffffff',
      boxShadow: isDarkMode
        ? '0 4px 20px rgba(0, 0, 0, 0.3)'
        : '0 4px 20px rgba(0, 0, 0, 0.05)',
      transition: 'transform 0.2s',
    },
    featureIcon: {
      fontSize: '40px',
      marginBottom: '16px',
    },
    featureTitle: {
      fontSize: '18px',
      fontWeight: '600',
      marginBottom: '10px',
      color: isDarkMode ? '#e0e0e0' : '#333',
    },
    featureDesc: {
      fontSize: '14px',
      lineHeight: '1.6',
      color: isDarkMode ? '#b0b0b0' : '#666',
    },
    // Screenshot Section
    screenshot: {
      padding: '80px 20px',
      textAlign: 'center',
    },
    screenshotContainer: {
      maxWidth: '900px',
      margin: '0 auto',
    },
    screenshotImage: {
      width: '100%',
      borderRadius: '16px',
      boxShadow: isDarkMode
        ? '0 20px 60px rgba(0, 0, 0, 0.5)'
        : '0 20px 60px rgba(0, 0, 0, 0.15)',
      backgroundColor: isDarkMode ? '#2d2d2d' : '#f0f0f0',
      minHeight: '400px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: isDarkMode ? '#666' : '#999',
      fontSize: '16px',
    },
    // Self-host Section
    selfHost: {
      padding: '80px 20px',
      backgroundColor: isDarkMode ? '#1a1a1a' : '#f8f9fa',
      textAlign: 'center',
    },
    selfHostContent: {
      maxWidth: '600px',
      margin: '0 auto',
    },
    // CTA Section
    cta: {
      padding: '80px 20px',
      textAlign: 'center',
      background: 'linear-gradient(135deg, #FF6B35 0%, #f7931e 100%)',
      color: '#fff',
    },
    ctaTitle: {
      fontSize: '32px',
      fontWeight: '700',
      marginBottom: '16px',
    },
    ctaDesc: {
      fontSize: '18px',
      marginBottom: '30px',
      opacity: 0.9,
    },
    ctaButton: {
      padding: '16px 40px',
      borderRadius: '10px',
      backgroundColor: '#fff',
      color: '#FF6B35',
      textDecoration: 'none',
      fontSize: '16px',
      fontWeight: '600',
      transition: 'all 0.2s',
      display: 'inline-block',
    },
  };

  const features = [
    { icon: '📰', title: t.feature1Title, desc: t.feature1Desc },
    { icon: '⭐', title: t.feature2Title, desc: t.feature2Desc },
    { icon: '🌙', title: t.feature3Title, desc: t.feature3Desc },
    { icon: '🔒', title: t.feature4Title, desc: t.feature4Desc },
  ];

  return (
    <div style={styles.page}>
      <PublicHeader />

      {/* Hero Section */}
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <h1 style={styles.tagline}>{t.tagline}</h1>
          <p style={styles.description}>{t.description}</p>
          <div style={styles.heroButtons}>
            <Link
              to="/login"
              style={styles.primaryButton}
              onMouseOver={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.4)';
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 14px rgba(255, 107, 53, 0.3)';
              }}
            >
              {t.getStarted}
            </Link>
            <Link
              to="/docs"
              style={styles.secondaryButton}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#FF6B35';
                e.target.style.color = '#fff';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = '#FF6B35';
              }}
            >
              {t.viewDocs}
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section style={styles.features}>
        <h2 style={styles.sectionTitle}>{t.featuresTitle}</h2>
        <p style={styles.sectionSubtitle}>{t.featuresSubtitle}</p>
        <div style={styles.featuresGrid}>
          {features.map((feature, index) => (
            <div
              key={index}
              style={styles.featureCard}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={styles.featureIcon}>{feature.icon}</div>
              <h3 style={styles.featureTitle}>{feature.title}</h3>
              <p style={styles.featureDesc}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Screenshot Section */}
      <section style={styles.screenshot}>
        <div style={styles.screenshotContainer}>
          <h2 style={styles.sectionTitle}>{t.screenshotTitle}</h2>
          <p style={styles.sectionSubtitle}>{t.screenshotSubtitle}</p>
          <img
            src={screenshotImage}
            alt="FeedOwn Dashboard"
            style={{
              width: '100%',
              borderRadius: '16px',
              boxShadow: isDarkMode
                ? '0 20px 60px rgba(0, 0, 0, 0.5)'
                : '0 20px 60px rgba(0, 0, 0, 0.15)',
            }}
          />
        </div>
      </section>

      {/* Self-host Section */}
      <section style={styles.selfHost}>
        <div style={styles.selfHostContent}>
          <h2 style={styles.sectionTitle}>{t.selfHostTitle}</h2>
          <p style={{ ...styles.description, marginBottom: '30px' }}>
            {t.selfHostDesc}
          </p>
          <Link
            to="/docs/setup"
            style={styles.secondaryButton}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = '#FF6B35';
              e.target.style.color = '#fff';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.color = '#FF6B35';
            }}
          >
            {t.selfHostButton}
          </Link>
        </div>
      </section>

      {/* CTA Section */}
      <section style={styles.cta}>
        <h2 style={styles.ctaTitle}>{t.ctaTitle}</h2>
        <p style={styles.ctaDesc}>{t.ctaDesc}</p>
        <Link
          to="/login"
          style={styles.ctaButton}
          onMouseOver={(e) => {
            e.target.style.transform = 'scale(1.05)';
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'scale(1)';
          }}
        >
          {t.ctaButton}
        </Link>
      </section>

      <Footer />
    </div>
  );
}
