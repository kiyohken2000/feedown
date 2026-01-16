import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../i18n/translations';
import PublicHeader from '../components/PublicHeader';
import Footer from '../components/Footer';

export default function DocsPage() {
  const { isDarkMode } = useTheme();
  const { language } = useLanguage();
  const t = translations[language].docs;
  const [activeSection, setActiveSection] = useState('what-is');

  const styles = {
    page: {
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: isDarkMode ? '#121212' : '#ffffff',
      color: isDarkMode ? '#e0e0e0' : '#333',
    },
    container: {
      flex: 1,
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '40px 20px',
      display: 'grid',
      gridTemplateColumns: '250px 1fr',
      gap: '40px',
    },
    sidebar: {
      position: 'sticky',
      top: '100px',
      height: 'fit-content',
    },
    sidebarSection: {
      marginBottom: '24px',
    },
    sidebarTitle: {
      fontSize: '12px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      color: isDarkMode ? '#888' : '#999',
      marginBottom: '12px',
    },
    sidebarLink: {
      display: 'block',
      padding: '8px 12px',
      borderRadius: '6px',
      fontSize: '14px',
      color: isDarkMode ? '#b0b0b0' : '#666',
      textDecoration: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s',
      marginBottom: '4px',
    },
    sidebarLinkActive: {
      backgroundColor: isDarkMode ? '#2d2d2d' : '#f0f0f0',
      color: '#FF6B35',
    },
    content: {
      maxWidth: '800px',
    },
    title: {
      fontSize: '36px',
      fontWeight: '700',
      marginBottom: '8px',
    },
    subtitle: {
      fontSize: '18px',
      color: isDarkMode ? '#888' : '#666',
      marginBottom: '40px',
    },
    section: {
      marginBottom: '48px',
    },
    sectionTitle: {
      fontSize: '24px',
      fontWeight: '600',
      marginBottom: '16px',
      color: isDarkMode ? '#e0e0e0' : '#333',
      borderBottom: `2px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
      paddingBottom: '8px',
    },
    paragraph: {
      fontSize: '16px',
      lineHeight: '1.8',
      color: isDarkMode ? '#b0b0b0' : '#555',
      marginBottom: '16px',
    },
    list: {
      paddingLeft: '24px',
      marginBottom: '16px',
    },
    listItem: {
      fontSize: '16px',
      lineHeight: '1.8',
      color: isDarkMode ? '#b0b0b0' : '#555',
      marginBottom: '8px',
    },
    faqItem: {
      marginBottom: '24px',
      padding: '20px',
      borderRadius: '10px',
      backgroundColor: isDarkMode ? '#1a1a1a' : '#f8f9fa',
    },
    faqQuestion: {
      fontSize: '16px',
      fontWeight: '600',
      marginBottom: '8px',
      color: isDarkMode ? '#e0e0e0' : '#333',
    },
    faqAnswer: {
      fontSize: '15px',
      lineHeight: '1.6',
      color: isDarkMode ? '#b0b0b0' : '#666',
    },
    setupLink: {
      display: 'inline-block',
      marginTop: '20px',
      padding: '12px 24px',
      borderRadius: '8px',
      backgroundColor: '#FF6B35',
      color: '#fff',
      textDecoration: 'none',
      fontSize: '14px',
      fontWeight: '500',
    },
  };

  const sidebarSections = [
    {
      title: t.gettingStarted,
      items: [
        { id: 'what-is', label: t.whatIs },
        { id: 'quick-start', label: t.quickStart },
      ],
    },
    {
      title: t.usage,
      items: [
        { id: 'adding-feeds', label: t.addingFeeds },
        { id: 'reading-articles', label: t.readingArticles },
        { id: 'favorites', label: t.favorites },
        { id: 'dark-mode', label: t.darkMode },
      ],
    },
    {
      title: t.mobile,
      items: [
        { id: 'mobile-setup', label: t.mobileSetup },
        { id: 'mobile-features', label: t.mobileFeatures },
      ],
    },
    {
      title: t.faq,
      items: [{ id: 'faq', label: t.faq }],
    },
  ];

  const scrollToSection = (id) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div style={styles.page}>
      <PublicHeader />

      <div style={styles.container}>
        {/* Sidebar */}
        <aside style={styles.sidebar}>
          {sidebarSections.map((section, idx) => (
            <div key={idx} style={styles.sidebarSection}>
              <div style={styles.sidebarTitle}>{section.title}</div>
              {section.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    ...styles.sidebarLink,
                    ...(activeSection === item.id ? styles.sidebarLinkActive : {}),
                  }}
                  onClick={() => scrollToSection(item.id)}
                >
                  {item.label}
                </div>
              ))}
            </div>
          ))}
          <Link to="/docs/setup" style={styles.setupLink}>
            {translations[language].header.setup} →
          </Link>
        </aside>

        {/* Content */}
        <main style={styles.content}>
          <h1 style={styles.title}>{t.title}</h1>
          <p style={styles.subtitle}>{t.subtitle}</p>

          {/* What is FeedOwn */}
          <section id="what-is" style={styles.section}>
            <h2 style={styles.sectionTitle}>{t.whatIsTitle}</h2>
            <p style={styles.paragraph}>{t.whatIsContent}</p>
          </section>

          {/* Quick Start */}
          <section id="quick-start" style={styles.section}>
            <h2 style={styles.sectionTitle}>{t.quickStartTitle}</h2>
            <ol style={styles.list}>
              <li style={styles.listItem}>{t.quickStartStep1}</li>
              <li style={styles.listItem}>{t.quickStartStep2}</li>
              <li style={styles.listItem}>{t.quickStartStep3}</li>
              <li style={styles.listItem}>{t.quickStartStep4}</li>
            </ol>
          </section>

          {/* Adding Feeds */}
          <section id="adding-feeds" style={styles.section}>
            <h2 style={styles.sectionTitle}>{t.addingFeedsTitle}</h2>
            <p style={styles.paragraph}>{t.addingFeedsContent}</p>
          </section>

          {/* Reading Articles */}
          <section id="reading-articles" style={styles.section}>
            <h2 style={styles.sectionTitle}>{t.readingArticlesTitle}</h2>
            <p style={styles.paragraph}>{t.readingArticlesContent}</p>
          </section>

          {/* Favorites */}
          <section id="favorites" style={styles.section}>
            <h2 style={styles.sectionTitle}>{t.favoritesTitle}</h2>
            <p style={styles.paragraph}>{t.favoritesContent}</p>
          </section>

          {/* Dark Mode */}
          <section id="dark-mode" style={styles.section}>
            <h2 style={styles.sectionTitle}>{t.darkModeTitle}</h2>
            <p style={styles.paragraph}>{t.darkModeContent}</p>
          </section>

          {/* Mobile Setup */}
          <section id="mobile-setup" style={styles.section}>
            <h2 style={styles.sectionTitle}>{t.mobileSetupTitle}</h2>
            <p style={styles.paragraph}>{t.mobileSetupContent}</p>
          </section>

          {/* Mobile Features */}
          <section id="mobile-features" style={styles.section}>
            <h2 style={styles.sectionTitle}>{t.mobileFeaturesTitle}</h2>
            <p style={styles.paragraph}>{t.mobileFeaturesContent}</p>
          </section>

          {/* FAQ */}
          <section id="faq" style={styles.section}>
            <h2 style={styles.sectionTitle}>{t.faqTitle}</h2>
            <div style={styles.faqItem}>
              <div style={styles.faqQuestion}>{t.faq1Q}</div>
              <div style={styles.faqAnswer}>{t.faq1A}</div>
            </div>
            <div style={styles.faqItem}>
              <div style={styles.faqQuestion}>{t.faq2Q}</div>
              <div style={styles.faqAnswer}>{t.faq2A}</div>
            </div>
            <div style={styles.faqItem}>
              <div style={styles.faqQuestion}>{t.faq3Q}</div>
              <div style={styles.faqAnswer}>{t.faq3A}</div>
            </div>
            <div style={styles.faqItem}>
              <div style={styles.faqQuestion}>{t.faq4Q}</div>
              <div style={styles.faqAnswer}>{t.faq4A}</div>
            </div>
          </section>
        </main>
      </div>

      <Footer />
    </div>
  );
}
