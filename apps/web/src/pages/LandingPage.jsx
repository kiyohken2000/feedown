import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LuNewspaper, LuStar, LuMoon, LuLock, LuArrowRight, LuBookOpen, LuServer, LuRocket, LuBrain, LuShieldCheck, LuMessagesSquare, LuLanguages, LuList } from 'react-icons/lu';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../i18n/translations';
import { getTokens } from '../styles/tokens';
import PublicHeader from '../components/PublicHeader';
import Footer from '../components/Footer';
import screenshotImage from '../assets/images/screenshot_1.png';
// Store badges
import appStoreBadge from '../assets/images/badges/appstore.png';
import googlePlayBadge from '../assets/images/badges/googleplay.png';
// Mobile screenshots
import mobileLogin from '../assets/images/mobile_screenshots/mobile_ss_login1.png';
import mobileSignup from '../assets/images/mobile_screenshots/mobile_ss_signup1.png';
import mobileArticles1 from '../assets/images/mobile_screenshots/mobile_ss_articles1.png';
import mobileArticles2 from '../assets/images/mobile_screenshots/mobile_ss_articles2.png';
import mobileArticle from '../assets/images/mobile_screenshots/mobile_ss_article1.png';
import mobileReader from '../assets/images/mobile_screenshots/mobile_ss_reader1.png';
import mobileFeeds from '../assets/images/mobile_screenshots/mobile_ss_feeds.png';
import mobileSettings from '../assets/images/mobile_screenshots/mobile_ss_settings1.png';
// On-Device AI screenshots
import aiSettings from '../assets/images/on_device_ai/01_settings.PNG';
import aiSummarize1 from '../assets/images/on_device_ai/02_summarize01_generating_summary.png';
import aiSummarize2 from '../assets/images/on_device_ai/02_summarize02_japanese_article.png';
import aiSummarize3 from '../assets/images/on_device_ai/02_summarize02_english_articla.png';
import aiSignals from '../assets/images/on_device_ai/03_signals.png';
import aiChat from '../assets/images/on_device_ai/04_chat.png';
import aiTranslation from '../assets/images/on_device_ai/05_translation.png';

export default function LandingPage() {
  const { isDarkMode } = useTheme();
  const { language } = useLanguage();
  const t = translations[language].landing;
  const [selectedImage, setSelectedImage] = useState(null);
  const { color, radius, shadow } = getTokens(isDarkMode);

  const styles = {
    page: {
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: color.appBg,
      color: color.text,
    },
    // Hero Section
    hero: {
      padding: '90px 20px',
      textAlign: 'center',
      background: isDarkMode
        ? `radial-gradient(900px 420px at 50% -10%, ${color.accentSoft} 0%, transparent 65%), ${color.appBg}`
        : `radial-gradient(900px 420px at 50% -10%, ${color.accentSoft} 0%, transparent 65%), ${color.appBg}`,
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
      color: color.textMuted,
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
      borderRadius: radius.md,
      backgroundColor: color.accent,
      color: color.onAccent,
      textDecoration: 'none',
      fontSize: '16px',
      fontWeight: 600,
      transition: 'all 0.2s',
      boxShadow: '0 4px 14px rgba(255, 107, 53, 0.3)',
    },
    secondaryButton: {
      padding: '14px 32px',
      borderRadius: radius.md,
      backgroundColor: color.surface,
      color: color.text,
      textDecoration: 'none',
      fontSize: '16px',
      fontWeight: 600,
      border: `1px solid ${color.border}`,
      transition: 'all 0.2s',
    },
    // Features Section
    features: {
      padding: '80px 20px',
      backgroundColor: color.surface2,
    },
    sectionTitle: {
      fontSize: '32px',
      fontWeight: 800,
      letterSpacing: '-0.02em',
      textAlign: 'center',
      marginBottom: '12px',
      color: color.text,
    },
    sectionSubtitle: {
      fontSize: '16px',
      textAlign: 'center',
      color: color.textMuted,
      marginBottom: '60px',
    },
    featuresGrid: {
      maxWidth: '1000px',
      margin: '0 auto',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '24px',
    },
    featureCard: {
      padding: '30px',
      borderRadius: radius.lg,
      backgroundColor: color.surface,
      border: `1px solid ${color.border}`,
      boxShadow: shadow.sm,
      transition: 'transform 0.2s, box-shadow 0.2s',
    },
    featureIcon: {
      fontSize: '34px',
      marginBottom: '16px',
      color: color.accent,
    },
    buttonIcon: {
      marginRight: '8px',
    },
    featureTitle: {
      fontSize: '18px',
      fontWeight: 700,
      marginBottom: '10px',
      color: color.text,
    },
    featureDesc: {
      fontSize: '14px',
      lineHeight: '1.6',
      color: color.textMuted,
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
      backgroundColor: color.surface2,
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
      fontWeight: 600,
      color: color.textMuted,
    },
    mobileDesc: {
      maxWidth: '700px',
      margin: '0 auto',
      textAlign: 'center',
      fontSize: '16px',
      lineHeight: '1.7',
      color: color.textMuted,
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
    // On-Device AI Section
    aiSection: {
      padding: '80px 20px',
      backgroundColor: color.appBg,
    },
    aiContent: {
      maxWidth: '1100px',
      margin: '0 auto',
    },
    aiFeatureGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '24px',
      marginBottom: '60px',
    },
    aiFeatureCard: {
      padding: '28px',
      borderRadius: radius.lg,
      backgroundColor: color.surface,
      border: `1px solid ${color.border}`,
      borderLeft: '4px solid #6C63FF',
      boxShadow: shadow.sm,
    },
    aiFeatureIcon: {
      fontSize: '32px',
      marginBottom: '14px',
      color: '#6C63FF',
    },
    aiScreenshotGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: '20px',
      marginBottom: '32px',
      justifyItems: 'center',
    },
    aiPrivacyBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 18px',
      borderRadius: '50px',
      backgroundColor: isDarkMode ? '#1e2a1e' : '#e8f5e9',
      color: isDarkMode ? '#81c784' : '#388e3c',
      fontSize: '13px',
      fontWeight: '600',
      marginBottom: '40px',
    },
    aiPrivacyNote: {
      maxWidth: '700px',
      margin: '0 auto',
      textAlign: 'center',
      fontSize: '14px',
      lineHeight: '1.7',
      color: color.textFaint,
    },
    // Self-host Section
    selfHost: {
      padding: '80px 20px',
      backgroundColor: color.surface2,
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
    { icon: LuNewspaper, title: t.feature1Title, desc: t.feature1Desc },
    { icon: LuStar, title: t.feature2Title, desc: t.feature2Desc },
    { icon: LuMoon, title: t.feature3Title, desc: t.feature3Desc },
    { icon: LuLock, title: t.feature4Title, desc: t.feature4Desc },
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
              <LuRocket style={styles.buttonIcon} />
              {t.getStarted}
            </Link>
            <Link
              to="/docs"
              style={{ ...styles.secondaryButton, display: 'inline-flex', alignItems: 'center' }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = color.surfaceHover;
                e.currentTarget.style.borderColor = color.accent;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = color.surface;
                e.currentTarget.style.borderColor = color.border;
              }}
            >
              <LuBookOpen style={styles.buttonIcon} />
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

      {/* On-Device AI Section */}
      <section style={styles.aiSection}>
        <div style={styles.aiContent}>
          <h2 style={styles.sectionTitle}>{t.aiTitle}</h2>
          <p style={styles.sectionSubtitle}>{t.aiSubtitle}</p>

          {/* Privacy badge */}
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <span style={styles.aiPrivacyBadge}>
              <LuShieldCheck />
              {t.aiDesc}
            </span>
          </div>

          {/* Feature cards */}
          <div style={styles.aiFeatureGrid}>
            {[
              { Icon: LuList, title: t.aiFeature1Title, desc: t.aiFeature1Desc },
              { Icon: LuBrain, title: t.aiFeature2Title, desc: t.aiFeature2Desc },
              { Icon: LuMessagesSquare, title: t.aiFeature3Title, desc: t.aiFeature3Desc },
              { Icon: LuLanguages, title: t.aiFeature4Title, desc: t.aiFeature4Desc },
            ].map(({ Icon, title, desc }, i) => (
              <div key={i} style={styles.aiFeatureCard}>
                <Icon style={styles.aiFeatureIcon} />
                <h3 style={styles.featureTitle}>{title}</h3>
                <p style={styles.featureDesc}>{desc}</p>
              </div>
            ))}
          </div>

          {/* Screenshot gallery */}
          <div style={styles.aiScreenshotGrid}>
            {[
              { src: aiSettings, label: t.aiSettings },
              { src: aiSummarize1, label: t.aiSummarize1 },
              { src: aiSummarize2, label: t.aiSummarize2 },
              { src: aiSummarize3, label: t.aiSummarize3 },
              { src: aiSignals, label: t.aiSignals },
              { src: aiChat, label: t.aiChat },
              { src: aiTranslation, label: t.aiTranslation },
            ].map(({ src, label }) => (
              <div key={label} style={styles.mobileScreenshot}>
                <img
                  src={src}
                  alt={label}
                  style={styles.mobileImage}
                  onClick={() => setSelectedImage({ src, alt: label })}
                  onMouseOver={(e) => { e.target.style.transform = 'scale(1.03)'; }}
                  onMouseOut={(e) => { e.target.style.transform = 'scale(1)'; }}
                />
                <p style={styles.mobileLabel}>{label}</p>
              </div>
            ))}
          </div>

          <p style={styles.aiPrivacyNote}>{t.aiPrivacyNote}</p>
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
              e.currentTarget.style.backgroundColor = color.surfaceHover;
              e.currentTarget.style.borderColor = color.accent;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = color.surface;
              e.currentTarget.style.borderColor = color.border;
            }}
          >
            <LuServer style={styles.buttonIcon} />
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
          <LuArrowRight style={{ marginLeft: '8px' }} />
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
