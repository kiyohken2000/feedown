import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaNewspaper, FaStar, FaMoon, FaLock, FaArrowRight, FaBook, FaServer, FaRocket } from 'react-icons/fa';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../i18n/translations';
import PublicHeader from '../components/PublicHeader';
import Footer from '../components/Footer';
import screenshotImage from '../assets/images/screenshot_1.png';
// Store badges
import appStoreBadge from '../assets/images/badges/appstore.png';
import googlePlayBadge from '../assets/images/badges/googleplay.png';
// Mobile screenshots
import mobileLogin from '../assets/images/mobile_screenshots/mobile_ss_login1.PNG';
import mobileSignup from '../assets/images/mobile_screenshots/mobile_ss_signup1.PNG';
import mobileArticles1 from '../assets/images/mobile_screenshots/mobile_ss_articles1.PNG';
import mobileArticles2 from '../assets/images/mobile_screenshots/mobile_ss_articles2.PNG';
import mobileArticle from '../assets/images/mobile_screenshots/mobile_ss_article1.PNG';
import mobileReader from '../assets/images/mobile_screenshots/mobile_ss_reader1.PNG';
import mobileFeeds from '../assets/images/mobile_screenshots/mobile_ss_feeds.PNG';
import mobileSettings from '../assets/images/mobile_screenshots/mobile_ss_settings1.PNG';

export default function LandingPage() {
  const { isDarkMode } = useTheme();
  const { language } = useLanguage();
  const t = translations[language].landing;
  const [selectedImage, setSelectedImage] = useState(null);

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
      color: '#FF6B35',
    },
    buttonIcon: {
      marginRight: '8px',
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
    // Mobile App Section
    mobileApp: {
      padding: '80px 20px',
      backgroundColor: isDarkMode ? '#1a1a1a' : '#f8f9fa',
    },
    mobileContent: {
      maxWidth: '1100px',
      margin: '0 auto',
    },
    mobileGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '24px',
      marginBottom: '40px',
      justifyItems: 'center',
    },
    mobileScreenshot: {
      textAlign: 'center',
    },
    mobileImage: {
      width: '100%',
      maxWidth: '220px',
      borderRadius: '16px',
      boxShadow: isDarkMode
        ? '0 10px 40px rgba(0, 0, 0, 0.4)'
        : '0 10px 40px rgba(0, 0, 0, 0.1)',
      transition: 'transform 0.3s ease',
      cursor: 'zoom-in',
    },
    mobileLabel: {
      marginTop: '12px',
      fontSize: '14px',
      fontWeight: '500',
      color: isDarkMode ? '#b0b0b0' : '#666',
    },
    mobileDesc: {
      maxWidth: '700px',
      margin: '0 auto',
      textAlign: 'center',
      fontSize: '16px',
      lineHeight: '1.7',
      color: isDarkMode ? '#b0b0b0' : '#666',
    },
    mobileButtons: {
      display: 'flex',
      gap: '16px',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: '30px',
      flexWrap: 'wrap',
    },
    storeLink: {
      display: 'flex',
      alignItems: 'center',
      transition: 'all 0.2s',
      borderRadius: '8px',
      height: '48px',
    },
    storeBadge: {
      height: '48px',
      width: 'auto',
      display: 'block',
      objectFit: 'contain',
    },
    // Image Modal
    modalOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      cursor: 'zoom-out',
      padding: '20px',
    },
    modalImage: {
      maxWidth: '90vw',
      maxHeight: '90vh',
      objectFit: 'contain',
      borderRadius: '12px',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
    },
    modalClose: {
      position: 'absolute',
      top: '20px',
      right: '20px',
      background: 'rgba(255, 255, 255, 0.1)',
      border: 'none',
      color: '#fff',
      fontSize: '32px',
      cursor: 'pointer',
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background 0.2s',
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
    { icon: FaNewspaper, title: t.feature1Title, desc: t.feature1Desc },
    { icon: FaStar, title: t.feature2Title, desc: t.feature2Desc },
    { icon: FaMoon, title: t.feature3Title, desc: t.feature3Desc },
    { icon: FaLock, title: t.feature4Title, desc: t.feature4Desc },
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
              style={{ ...styles.primaryButton, display: 'inline-flex', alignItems: 'center' }}
              onMouseOver={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(255, 107, 53, 0.4)';
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 14px rgba(255, 107, 53, 0.3)';
              }}
            >
              <FaRocket style={styles.buttonIcon} />
              {t.getStarted}
            </Link>
            <Link
              to="/docs"
              style={{ ...styles.secondaryButton, display: 'inline-flex', alignItems: 'center' }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#FF6B35';
                e.target.style.color = '#fff';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = '#FF6B35';
              }}
            >
              <FaBook style={styles.buttonIcon} />
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
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
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
                <IconComponent style={styles.featureIcon} />
                <h3 style={styles.featureTitle}>{feature.title}</h3>
                <p style={styles.featureDesc}>{feature.desc}</p>
              </div>
            );
          })}
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

      {/* Mobile App Section */}
      <section style={styles.mobileApp}>
        <div style={styles.mobileContent}>
          <h2 style={styles.sectionTitle}>{t.mobileTitle}</h2>
          <p style={styles.sectionSubtitle}>{t.mobileSubtitle}</p>
          <div style={styles.mobileGrid}>
            <div style={styles.mobileScreenshot}>
              <img
                src={mobileLogin}
                alt="Login"
                style={styles.mobileImage}
                onClick={() => setSelectedImage({ src: mobileLogin, alt: t.mobileLogin })}
                onMouseOver={(e) => { e.target.style.transform = 'scale(1.03)'; }}
                onMouseOut={(e) => { e.target.style.transform = 'scale(1)'; }}
              />
              <p style={styles.mobileLabel}>{t.mobileLogin}</p>
            </div>
            <div style={styles.mobileScreenshot}>
              <img
                src={mobileSignup}
                alt="Sign Up"
                style={styles.mobileImage}
                onClick={() => setSelectedImage({ src: mobileSignup, alt: t.mobileSignup })}
                onMouseOver={(e) => { e.target.style.transform = 'scale(1.03)'; }}
                onMouseOut={(e) => { e.target.style.transform = 'scale(1)'; }}
              />
              <p style={styles.mobileLabel}>{t.mobileSignup}</p>
            </div>
            <div style={styles.mobileScreenshot}>
              <img
                src={mobileArticles1}
                alt="Articles"
                style={styles.mobileImage}
                onClick={() => setSelectedImage({ src: mobileArticles1, alt: t.mobileArticles1 })}
                onMouseOver={(e) => { e.target.style.transform = 'scale(1.03)'; }}
                onMouseOut={(e) => { e.target.style.transform = 'scale(1)'; }}
              />
              <p style={styles.mobileLabel}>{t.mobileArticles1}</p>
            </div>
            <div style={styles.mobileScreenshot}>
              <img
                src={mobileArticles2}
                alt="Dark Mode"
                style={styles.mobileImage}
                onClick={() => setSelectedImage({ src: mobileArticles2, alt: t.mobileArticles2 })}
                onMouseOver={(e) => { e.target.style.transform = 'scale(1.03)'; }}
                onMouseOut={(e) => { e.target.style.transform = 'scale(1)'; }}
              />
              <p style={styles.mobileLabel}>{t.mobileArticles2}</p>
            </div>
            <div style={styles.mobileScreenshot}>
              <img
                src={mobileArticle}
                alt="Article Detail"
                style={styles.mobileImage}
                onClick={() => setSelectedImage({ src: mobileArticle, alt: t.mobileArticle })}
                onMouseOver={(e) => { e.target.style.transform = 'scale(1.03)'; }}
                onMouseOut={(e) => { e.target.style.transform = 'scale(1)'; }}
              />
              <p style={styles.mobileLabel}>{t.mobileArticle}</p>
            </div>
            <div style={styles.mobileScreenshot}>
              <img
                src={mobileReader}
                alt="Reader Mode"
                style={styles.mobileImage}
                onClick={() => setSelectedImage({ src: mobileReader, alt: t.mobileReader })}
                onMouseOver={(e) => { e.target.style.transform = 'scale(1.03)'; }}
                onMouseOut={(e) => { e.target.style.transform = 'scale(1)'; }}
              />
              <p style={styles.mobileLabel}>{t.mobileReader}</p>
            </div>
            <div style={styles.mobileScreenshot}>
              <img
                src={mobileFeeds}
                alt="Feed Management"
                style={styles.mobileImage}
                onClick={() => setSelectedImage({ src: mobileFeeds, alt: t.mobileFeeds })}
                onMouseOver={(e) => { e.target.style.transform = 'scale(1.03)'; }}
                onMouseOut={(e) => { e.target.style.transform = 'scale(1)'; }}
              />
              <p style={styles.mobileLabel}>{t.mobileFeeds}</p>
            </div>
            <div style={styles.mobileScreenshot}>
              <img
                src={mobileSettings}
                alt="Settings"
                style={styles.mobileImage}
                onClick={() => setSelectedImage({ src: mobileSettings, alt: t.mobileSettings })}
                onMouseOver={(e) => { e.target.style.transform = 'scale(1.03)'; }}
                onMouseOut={(e) => { e.target.style.transform = 'scale(1)'; }}
              />
              <p style={styles.mobileLabel}>{t.mobileSettings}</p>
            </div>
          </div>
          <p style={styles.mobileDesc}>{t.mobileDesc}</p>
          <div style={styles.mobileButtons}>
            <a
              href="https://apps.apple.com/us/app/feedown/id6757896656"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.storeLink}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.opacity = '0.85'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.opacity = '1'; }}
            >
              <img src={appStoreBadge} alt="Download on the App Store" style={styles.storeBadge} />
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=net.votepurchase.feedown"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.storeLink}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.opacity = '0.85'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.opacity = '1'; }}
            >
              <img src={googlePlayBadge} alt="Get it on Google Play" style={styles.storeBadge} />
            </a>
          </div>
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
            style={{ ...styles.secondaryButton, display: 'inline-flex', alignItems: 'center' }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = '#FF6B35';
              e.target.style.color = '#fff';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.color = '#FF6B35';
            }}
          >
            <FaServer style={styles.buttonIcon} />
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
          style={{ ...styles.ctaButton, display: 'inline-flex', alignItems: 'center' }}
          onMouseOver={(e) => {
            e.target.style.transform = 'scale(1.05)';
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'scale(1)';
          }}
        >
          {t.ctaButton}
          <FaArrowRight style={{ marginLeft: '8px' }} />
        </Link>
      </section>

      {/* Image Modal */}
      {selectedImage && (
        <div
          style={styles.modalOverlay}
          onClick={() => setSelectedImage(null)}
        >
          <button
            style={styles.modalClose}
            onClick={() => setSelectedImage(null)}
            onMouseOver={(e) => { e.target.style.background = 'rgba(255, 255, 255, 0.2)'; }}
            onMouseOut={(e) => { e.target.style.background = 'rgba(255, 255, 255, 0.1)'; }}
          >
            ×
          </button>
          <img
            src={selectedImage.src}
            alt={selectedImage.alt}
            style={styles.modalImage}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <Footer />
    </div>
  );
}
