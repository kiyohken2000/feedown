import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../i18n/translations';
import PublicHeader from '../components/PublicHeader';
import Footer from '../components/Footer';

// Web app screenshots
import webApp8 from '../assets/images/web_screenshots/web_app_8.png';
import webApp2 from '../assets/images/web_screenshots/web_app_2.png';
import webApp3 from '../assets/images/web_screenshots/web_app_3.png';
import webApp4 from '../assets/images/web_screenshots/web_app_4.png';
import webApp5 from '../assets/images/web_screenshots/web_app_5.png';
import webApp6 from '../assets/images/web_screenshots/web_app_6.png';

// Mobile app screenshots
import mobileLogin from '../assets/images/mobile_screenshots/mobile_ss_login1.PNG';
import mobileSignup from '../assets/images/mobile_screenshots/mobile_ss_signup1.PNG';
import mobileArticles1 from '../assets/images/mobile_screenshots/mobile_ss_articles1.PNG';
import mobileArticle from '../assets/images/mobile_screenshots/mobile_ss_article1.PNG';
import mobileReader from '../assets/images/mobile_screenshots/mobile_ss_reader1.PNG';
import mobileFeeds from '../assets/images/mobile_screenshots/mobile_ss_feeds.PNG';
import mobileSettings from '../assets/images/mobile_screenshots/mobile_ss_settings1.PNG';

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
      textAlign: 'left',
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
      textAlign: 'left',
    },
    listItem: {
      fontSize: '16px',
      lineHeight: '1.8',
      color: isDarkMode ? '#b0b0b0' : '#555',
      marginBottom: '8px',
      textAlign: 'left',
    },
    screenshot: {
      width: '100%',
      maxWidth: '100%',
      borderRadius: '8px',
      border: `1px solid ${isDarkMode ? '#333' : '#e1e4e8'}`,
      marginBottom: '8px',
      marginTop: '16px',
      boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.1)',
    },
    screenshotCaption: {
      fontSize: '14px',
      color: isDarkMode ? '#888' : '#666',
      textAlign: 'center',
      marginBottom: '16px',
      fontStyle: 'italic',
    },
    screenshotGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '16px',
      marginTop: '16px',
      marginBottom: '16px',
    },
    mobileScreenshotGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '16px',
      marginTop: '16px',
      marginBottom: '16px',
    },
    mobileScreenshotItem: {
      textAlign: 'center',
    },
    mobileScreenshot: {
      width: '100%',
      maxWidth: '200px',
      borderRadius: '12px',
      border: `1px solid ${isDarkMode ? '#333' : '#e1e4e8'}`,
      marginBottom: '8px',
      boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.1)',
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
            <img src={webApp8} alt="Login Screen" style={styles.screenshot} />
            <p style={styles.screenshotCaption}>{language === 'en' ? 'Login / Sign Up Screen' : 'ログイン / サインアップ画面'}</p>
          </section>

          {/* Adding Feeds */}
          <section id="adding-feeds" style={styles.section}>
            <h2 style={styles.sectionTitle}>{t.addingFeedsTitle}</h2>
            <p style={styles.paragraph}>{t.addingFeedsContent}</p>
            <img src={webApp4} alt="Feed Management" style={styles.screenshot} />
            <p style={styles.screenshotCaption}>{language === 'en' ? 'Feed Management - Add and organize your RSS feeds' : 'フィード管理 - RSSフィードの追加と整理'}</p>
          </section>

          {/* Reading Articles */}
          <section id="reading-articles" style={styles.section}>
            <h2 style={styles.sectionTitle}>{t.readingArticlesTitle}</h2>
            <p style={styles.paragraph}>{t.readingArticlesContent}</p>
            <div style={styles.screenshotGrid}>
              <div>
                <img src={webApp2} alt="Article List" style={{ ...styles.screenshot, marginTop: 0 }} />
                <p style={styles.screenshotCaption}>{language === 'en' ? 'Article List' : '記事一覧'}</p>
              </div>
              <div>
                <img src={webApp3} alt="Article Detail" style={{ ...styles.screenshot, marginTop: 0 }} />
                <p style={styles.screenshotCaption}>{language === 'en' ? 'Article Detail' : '記事詳細'}</p>
              </div>
            </div>
          </section>

          {/* Favorites */}
          <section id="favorites" style={styles.section}>
            <h2 style={styles.sectionTitle}>{t.favoritesTitle}</h2>
            <p style={styles.paragraph}>{t.favoritesContent}</p>
            <img src={webApp5} alt="Favorites" style={styles.screenshot} />
            <p style={styles.screenshotCaption}>{language === 'en' ? 'Favorites - Save articles for later' : 'お気に入り - 記事を後で読むために保存'}</p>
          </section>

          {/* Dark Mode */}
          <section id="dark-mode" style={styles.section}>
            <h2 style={styles.sectionTitle}>{t.darkModeTitle}</h2>
            <p style={styles.paragraph}>{t.darkModeContent}</p>
            <img src={webApp6} alt="Light Mode" style={styles.screenshot} />
            <p style={styles.screenshotCaption}>{language === 'en' ? 'Toggle between light and dark mode' : 'ライトモードとダークモードの切り替え'}</p>
          </section>

          {/* Mobile Setup */}
          <section id="mobile-setup" style={styles.section}>
            <h2 style={styles.sectionTitle}>{t.mobileSetupTitle}</h2>
            <p style={styles.paragraph}>{t.mobileSetupContent}</p>
            <div style={styles.mobileScreenshotGrid}>
              <div style={styles.mobileScreenshotItem}>
                <img src={mobileLogin} alt="Mobile Login" style={styles.mobileScreenshot} />
                <p style={styles.screenshotCaption}>{language === 'en' ? 'Login Screen' : 'ログイン画面'}</p>
              </div>
              <div style={styles.mobileScreenshotItem}>
                <img src={mobileSignup} alt="Mobile Signup" style={styles.mobileScreenshot} />
                <p style={styles.screenshotCaption}>{language === 'en' ? 'Sign Up Screen' : 'サインアップ画面'}</p>
              </div>
            </div>
          </section>

          {/* Mobile Features */}
          <section id="mobile-features" style={styles.section}>
            <h2 style={styles.sectionTitle}>{t.mobileFeaturesTitle}</h2>
            <p style={styles.paragraph}>{t.mobileFeaturesContent}</p>
            <div style={styles.mobileScreenshotGrid}>
              <div style={styles.mobileScreenshotItem}>
                <img src={mobileArticles1} alt="Mobile Articles" style={styles.mobileScreenshot} />
                <p style={styles.screenshotCaption}>{language === 'en' ? 'Article List' : '記事一覧'}</p>
              </div>
              <div style={styles.mobileScreenshotItem}>
                <img src={mobileArticle} alt="Mobile Article Detail" style={styles.mobileScreenshot} />
                <p style={styles.screenshotCaption}>{language === 'en' ? 'Article Detail' : '記事詳細'}</p>
              </div>
              <div style={styles.mobileScreenshotItem}>
                <img src={mobileReader} alt="Mobile Reader Mode" style={styles.mobileScreenshot} />
                <p style={styles.screenshotCaption}>{language === 'en' ? 'Reader Mode' : 'リーダーモード'}</p>
              </div>
              <div style={styles.mobileScreenshotItem}>
                <img src={mobileFeeds} alt="Mobile Feeds" style={styles.mobileScreenshot} />
                <p style={styles.screenshotCaption}>{language === 'en' ? 'Feed Management' : 'フィード管理'}</p>
              </div>
              <div style={styles.mobileScreenshotItem}>
                <img src={mobileSettings} alt="Mobile Settings" style={styles.mobileScreenshot} />
                <p style={styles.screenshotCaption}>{language === 'en' ? 'Settings' : '設定'}</p>
              </div>
            </div>
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
