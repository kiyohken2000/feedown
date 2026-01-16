import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../i18n/translations';
import PublicHeader from '../components/PublicHeader';
import Footer from '../components/Footer';

// Web screenshots
import supabaseDashboard1 from '../assets/images/web_screenshots/supabase_dashboard_1.png';
import supabaseDashboard2 from '../assets/images/web_screenshots/supabase_dashboard_2.png';
import supabaseDashboard3 from '../assets/images/web_screenshots/supabase_dashboard_3.png';
import supabaseDashboard4 from '../assets/images/web_screenshots/supabase_dashboard_4.png';
import supabaseDashboard5 from '../assets/images/web_screenshots/supabase_dashboard_5.png';
import supabaseDashboard6 from '../assets/images/web_screenshots/supabase_dashboard_6.png';
import cloudflareDashboard1 from '../assets/images/web_screenshots/cloudflare_dashboard_1.png';
import cloudflareDashboard2 from '../assets/images/web_screenshots/cloudflare_dashboard_2.png';
import cloudflareDashboard3 from '../assets/images/web_screenshots/cloudflare_dashboard_3.png';
import webApp1 from '../assets/images/web_screenshots/web_app_1.png';
import webApp2 from '../assets/images/web_screenshots/web_app_2.png';
import webApp3 from '../assets/images/web_screenshots/web_app_3.png';
import webApp4 from '../assets/images/web_screenshots/web_app_4.png';
import webApp5 from '../assets/images/web_screenshots/web_app_5.png';
import webApp6 from '../assets/images/web_screenshots/web_app_6.png';
import webApp7 from '../assets/images/web_screenshots/web_app_7.png';
import webApp8 from '../assets/images/web_screenshots/web_app_8.png';

export default function SetupGuidePage() {
  const { isDarkMode } = useTheme();
  const { language } = useLanguage();
  const t = translations[language].setup;
  const [activeSection, setActiveSection] = useState('prerequisites');

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
      marginBottom: '16px',
      boxShadow: isDarkMode ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.1)',
    },
    screenshotCaption: {
      fontSize: '14px',
      color: isDarkMode ? '#888' : '#666',
      textAlign: 'center',
      marginTop: '-8px',
      marginBottom: '24px',
      fontStyle: 'italic',
    },
    codeBlock: {
      backgroundColor: isDarkMode ? '#1e1e1e' : '#f6f8fa',
      border: `1px solid ${isDarkMode ? '#333' : '#e1e4e8'}`,
      borderRadius: '8px',
      padding: '16px',
      overflowX: 'auto',
      marginBottom: '16px',
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      fontSize: '14px',
      lineHeight: '1.6',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      textAlign: 'left',
    },
    code: {
      color: isDarkMode ? '#e6e6e6' : '#24292e',
    },
    inlineCode: {
      backgroundColor: isDarkMode ? '#2d2d2d' : '#f0f0f0',
      padding: '2px 6px',
      borderRadius: '4px',
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      fontSize: '14px',
      color: isDarkMode ? '#ff7b72' : '#d73a49',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      marginBottom: '16px',
      fontSize: '14px',
    },
    th: {
      backgroundColor: isDarkMode ? '#2d2d2d' : '#f6f8fa',
      padding: '12px',
      textAlign: 'left',
      borderBottom: `2px solid ${isDarkMode ? '#444' : '#e1e4e8'}`,
      fontWeight: '600',
    },
    td: {
      padding: '12px',
      borderBottom: `1px solid ${isDarkMode ? '#333' : '#e1e4e8'}`,
      color: isDarkMode ? '#b0b0b0' : '#555',
    },
    stepNumber: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      backgroundColor: '#FF6B35',
      color: '#fff',
      fontSize: '14px',
      fontWeight: '600',
      marginRight: '12px',
    },
    stepTitle: {
      display: 'flex',
      alignItems: 'center',
      fontSize: '20px',
      fontWeight: '600',
      marginBottom: '12px',
      color: isDarkMode ? '#e0e0e0' : '#333',
    },
    note: {
      backgroundColor: isDarkMode ? '#2d2d1a' : '#fff8e6',
      border: `1px solid ${isDarkMode ? '#665500' : '#ffd700'}`,
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px',
    },
    noteTitle: {
      fontWeight: '600',
      marginBottom: '8px',
      color: isDarkMode ? '#ffd700' : '#996600',
    },
    backLink: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '20px',
      color: '#FF6B35',
      textDecoration: 'none',
      fontSize: '14px',
    },
  };

  const sidebarSections = [
    {
      title: language === 'en' ? 'Overview' : '概要',
      items: [
        { id: 'prerequisites', label: t.requirements },
      ],
    },
    {
      title: language === 'en' ? 'Setup Steps' : 'セットアップ手順',
      items: [
        { id: 'supabase', label: language === 'en' ? '1. Supabase' : '1. Supabase' },
        { id: 'workers', label: language === 'en' ? '2. Workers' : '2. Workers' },
        { id: 'pages', label: language === 'en' ? '3. Pages' : '3. Pages' },
        { id: 'env-vars', label: language === 'en' ? '4. Environment' : '4. 環境変数' },
      ],
    },
    {
      title: language === 'en' ? 'Additional' : 'その他',
      items: [
        { id: 'local-dev', label: language === 'en' ? 'Local Development' : 'ローカル開発' },
        { id: 'mobile', label: language === 'en' ? 'Mobile App' : 'モバイルアプリ' },
        { id: 'troubleshooting', label: language === 'en' ? 'Troubleshooting' : 'トラブルシューティング' },
      ],
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
          <Link to="/docs" style={styles.backLink}>
            ← {language === 'en' ? 'Back to Docs' : 'ドキュメントに戻る'}
          </Link>
        </aside>

        {/* Content */}
        <main style={styles.content}>
          <h1 style={styles.title}>{t.title}</h1>
          <p style={styles.subtitle}>{t.subtitle}</p>
          <p style={styles.paragraph}>{t.intro}</p>

          {/* Prerequisites */}
          <section id="prerequisites" style={styles.section}>
            <h2 style={styles.sectionTitle}>{t.requirements}</h2>

            <h3 style={{ ...styles.stepTitle, fontSize: '18px', marginTop: '20px' }}>
              {language === 'en' ? 'Required Accounts' : '必要なアカウント'}
            </h3>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>{language === 'en' ? 'Service' : 'サービス'}</th>
                  <th style={styles.th}>{language === 'en' ? 'Purpose' : '用途'}</th>
                  <th style={styles.th}>{language === 'en' ? 'Free Tier' : '無料枠'}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={styles.td}>Supabase</td>
                  <td style={styles.td}>{language === 'en' ? 'Database & Auth' : 'データベース・認証'}</td>
                  <td style={styles.td}>500MB DB, 50,000 MAU</td>
                </tr>
                <tr>
                  <td style={styles.td}>Cloudflare</td>
                  <td style={styles.td}>{language === 'en' ? 'Hosting & Workers' : 'ホスティング・Workers'}</td>
                  <td style={styles.td}>{language === 'en' ? '100k req/day' : '10万req/日'}</td>
                </tr>
                <tr>
                  <td style={styles.td}>Expo ({language === 'en' ? 'optional' : 'オプション'})</td>
                  <td style={styles.td}>{language === 'en' ? 'Mobile builds' : 'モバイルアプリビルド'}</td>
                  <td style={styles.td}>{language === 'en' ? '30 builds/month' : '30ビルド/月'}</td>
                </tr>
              </tbody>
            </table>

            <h3 style={{ ...styles.stepTitle, fontSize: '18px', marginTop: '20px' }}>
              {language === 'en' ? 'Required Tools' : '必要なツール'}
            </h3>
            <ul style={styles.list}>
              {t.requirementsList.map((item, idx) => (
                <li key={idx} style={styles.listItem}>{item}</li>
              ))}
            </ul>
            <div style={styles.codeBlock}>
              <code style={styles.code}>
{`# Node.js (v22+)
node --version  # v22.19.0+

# npm or yarn
npm --version   # v10+

# Wrangler CLI
npm install -g wrangler

# Git
git --version`}
              </code>
            </div>
          </section>

          {/* Step 1: Supabase */}
          <section id="supabase" style={styles.section}>
            <h2 style={styles.sectionTitle}>{t.step1Title}</h2>
            <p style={styles.paragraph}>{t.step1Content}</p>

            <div style={styles.stepTitle}>
              <span style={styles.stepNumber}>1</span>
              {language === 'en' ? 'Create Project' : 'プロジェクト作成'}
            </div>
            <ol style={styles.list}>
              <li style={styles.listItem}>
                {language === 'en'
                  ? 'Go to supabase.com and sign up/login'
                  : 'supabase.com にアクセスしてサインアップ/ログイン'}
              </li>
              <li style={styles.listItem}>
                {language === 'en'
                  ? 'Click "New Project" and configure:'
                  : '「New Project」をクリックして設定:'}
                <ul style={{ ...styles.list, marginTop: '8px', textAlign: 'left' }}>
                  <li><strong>Project name:</strong> feedown</li>
                  <li><strong>Database Password:</strong> {language === 'en' ? 'Set a secure password' : '安全なパスワードを設定'}</li>
                  <li><strong>Region:</strong> {language === 'en' ? 'Choose nearest region' : '最寄りのリージョン'}</li>
                </ul>
              </li>
            </ol>
            <img src={supabaseDashboard1} alt="Supabase Dashboard" style={styles.screenshot} />
            <p style={styles.screenshotCaption}>{language === 'en' ? 'Supabase Dashboard - Create New Project' : 'Supabaseダッシュボード - 新規プロジェクト作成'}</p>

            <div style={styles.stepTitle}>
              <span style={styles.stepNumber}>2</span>
              {language === 'en' ? 'Create Database Schema' : 'データベーススキーマ作成'}
            </div>
            <p style={styles.paragraph}>
              {language === 'en'
                ? 'Open SQL Editor in Supabase dashboard and run the following SQL:'
                : 'Supabaseダッシュボードの「SQL Editor」を開き、以下のSQLを実行:'}
            </p>
            <img src={supabaseDashboard2} alt="Supabase SQL Editor" style={styles.screenshot} />
            <p style={styles.screenshotCaption}>{language === 'en' ? 'SQL Editor - Run the schema creation SQL' : 'SQL Editor - スキーマ作成SQLを実行'}</p>
            <div style={styles.codeBlock}>
              <code style={styles.code}>
{`-- User profiles
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  is_test_account BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feeds
CREATE TABLE feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  favicon_url TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  last_fetched_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  error_count INTEGER DEFAULT 0,
  "order" BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  UNIQUE(user_id, url)
);

-- Articles (7-day TTL)
CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_id UUID NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  feed_title TEXT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  author TEXT,
  image_url TEXT
);

-- Read articles
CREATE TABLE read_articles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, article_id)
);

-- Favorites (permanent)
CREATE TABLE favorites (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  feed_title TEXT,
  image_url TEXT,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, id)
);

-- Recommended feeds
CREATE TABLE recommended_feeds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`}
              </code>
            </div>

            <div style={styles.stepTitle}>
              <span style={styles.stepNumber}>3</span>
              {language === 'en' ? 'Enable Row Level Security' : 'RLSを有効化'}
            </div>
            <div style={styles.codeBlock}>
              <code style={styles.code}>
{`-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE read_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommended_feeds ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage own profile" ON user_profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can manage own feeds" ON feeds
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own articles" ON articles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own read_articles" ON read_articles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own favorites" ON favorites
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read active recommended feeds" ON recommended_feeds
  FOR SELECT USING (is_active = true);`}
              </code>
            </div>

            <div style={styles.stepTitle}>
              <span style={styles.stepNumber}>4</span>
              {language === 'en' ? 'Get API Keys' : 'APIキー取得'}
            </div>
            <p style={styles.paragraph}>
              {language === 'en'
                ? 'Go to Settings → API and note down:'
                : 'Settings → API に移動して以下をメモ:'}
            </p>
            <img src={supabaseDashboard3} alt="Supabase API Settings" style={styles.screenshot} />
            <p style={styles.screenshotCaption}>{language === 'en' ? 'Settings → API - Get your API keys' : 'Settings → API - APIキーを取得'}</p>
            <ul style={styles.list}>
              <li style={styles.listItem}>
                <strong>Project URL:</strong> <code style={styles.inlineCode}>https://xxxxx.supabase.co</code>
              </li>
              <li style={styles.listItem}>
                <strong>anon public key:</strong> {language === 'en' ? 'For frontend' : 'フロントエンド用'}
              </li>
              <li style={styles.listItem}>
                <strong>service_role key:</strong> {language === 'en' ? 'For backend (keep secret!)' : 'バックエンド用（秘密）'}
              </li>
            </ul>
          </section>

          {/* Step 2: Workers */}
          <section id="workers" style={styles.section}>
            <h2 style={styles.sectionTitle}>{t.step2Title}</h2>
            <p style={styles.paragraph}>{t.step2Content}</p>

            <div style={styles.stepTitle}>
              <span style={styles.stepNumber}>1</span>
              {language === 'en' ? 'Create KV Namespace' : 'KV Namespace作成'}
            </div>
            <div style={styles.codeBlock}>
              <code style={styles.code}>
{`# Login to Wrangler
wrangler login

# Create KV Namespace
wrangler kv namespace create "CACHE"
# => Note the ID

# Create Preview KV Namespace
wrangler kv namespace create "CACHE" --preview
# => Note the preview_id`}
              </code>
            </div>

            <div style={styles.stepTitle}>
              <span style={styles.stepNumber}>2</span>
              {language === 'en' ? 'Configure wrangler.toml' : 'wrangler.toml設定'}
            </div>
            <p style={styles.paragraph}>
              {language === 'en'
                ? 'Edit workers/wrangler.toml:'
                : 'workers/wrangler.toml を編集:'}
            </p>
            <div style={styles.codeBlock}>
              <code style={styles.code}>
{`name = "feedown-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

account_id = "your-account-id"

[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-id"
preview_id = "your-preview-kv-id"

[observability]
enabled = true`}
              </code>
            </div>

            <div style={styles.stepTitle}>
              <span style={styles.stepNumber}>3</span>
              {language === 'en' ? 'Deploy Worker' : 'Workerデプロイ'}
            </div>
            <div style={styles.codeBlock}>
              <code style={styles.code}>
{`cd workers
npm install
wrangler deploy`}
              </code>
            </div>
            <p style={styles.paragraph}>
              {language === 'en'
                ? 'Note the Worker URL: '
                : 'Worker URLをメモ: '}
              <code style={styles.inlineCode}>https://feedown-worker.your-subdomain.workers.dev</code>
            </p>
          </section>

          {/* Step 3: Pages */}
          <section id="pages" style={styles.section}>
            <h2 style={styles.sectionTitle}>{t.step3Title}</h2>
            <p style={styles.paragraph}>{t.step3Content}</p>

            <div style={styles.stepTitle}>
              <span style={styles.stepNumber}>1</span>
              {language === 'en' ? 'Clone Repository' : 'リポジトリをクローン'}
            </div>
            <div style={styles.codeBlock}>
              <code style={styles.code}>
{`git clone https://github.com/kiyohken2000/feedown.git
cd feedown
npm install`}
              </code>
            </div>

            <div style={styles.stepTitle}>
              <span style={styles.stepNumber}>2</span>
              {language === 'en' ? 'Create .env file' : '.envファイル作成'}
            </div>
            <p style={styles.paragraph}>
              {language === 'en'
                ? 'Create apps/web/.env:'
                : 'apps/web/.env を作成:'}
            </p>
            <div style={styles.codeBlock}>
              <code style={styles.code}>
{`VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_WORKER_URL=https://feedown-worker.your-subdomain.workers.dev
VITE_APP_NAME=FeedOwn
VITE_APP_VERSION=1.0.0`}
              </code>
            </div>

            <div style={styles.stepTitle}>
              <span style={styles.stepNumber}>3</span>
              {language === 'en' ? 'Build and Deploy' : 'ビルドとデプロイ'}
            </div>
            <div style={styles.note}>
              <div style={styles.noteTitle}>
                {language === 'en' ? 'Important!' : '重要！'}
              </div>
              {language === 'en'
                ? 'Always deploy from the root directory, not from apps/web.'
                : '必ずルートディレクトリからデプロイしてください。apps/webからデプロイしないでください。'}
            </div>
            <div style={styles.codeBlock}>
              <code style={styles.code}>
{`# Run from root directory!
npm run build:web

# Deploy to Pages
npx wrangler pages deploy apps/web/dist --project-name=feedown`}
              </code>
            </div>
          </section>

          {/* Step 4: Environment Variables */}
          <section id="env-vars" style={styles.section}>
            <h2 style={styles.sectionTitle}>{t.step4Title}</h2>
            <p style={styles.paragraph}>{t.step4Content}</p>

            <ol style={styles.list}>
              <li style={styles.listItem}>
                {language === 'en'
                  ? 'Go to Cloudflare Dashboard → Pages → feedown → Settings → Environment variables'
                  : 'Cloudflare Dashboard → Pages → feedown → Settings → Environment variables'}
              </li>
              <li style={styles.listItem}>
                {language === 'en' ? 'Add these variables:' : '以下の変数を追加:'}
              </li>
            </ol>
            <img src={cloudflareDashboard1} alt="Cloudflare Dashboard" style={styles.screenshot} />
            <p style={styles.screenshotCaption}>{language === 'en' ? 'Cloudflare Pages - Environment Variables' : 'Cloudflare Pages - 環境変数設定'}</p>

            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>{language === 'en' ? 'Variable' : '変数名'}</th>
                  <th style={styles.th}>{language === 'en' ? 'Value' : '値'}</th>
                  <th style={styles.th}>{language === 'en' ? 'Note' : '備考'}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={styles.td}><code style={styles.inlineCode}>SUPABASE_URL</code></td>
                  <td style={styles.td}>https://xxxxx.supabase.co</td>
                  <td style={styles.td}></td>
                </tr>
                <tr>
                  <td style={styles.td}><code style={styles.inlineCode}>SUPABASE_ANON_KEY</code></td>
                  <td style={styles.td}>eyJhbG...</td>
                  <td style={styles.td}></td>
                </tr>
                <tr>
                  <td style={styles.td}><code style={styles.inlineCode}>SUPABASE_SERVICE_ROLE_KEY</code></td>
                  <td style={styles.td}>eyJhbG...</td>
                  <td style={styles.td}><strong>Secret</strong></td>
                </tr>
                <tr>
                  <td style={styles.td}><code style={styles.inlineCode}>WORKER_URL</code></td>
                  <td style={styles.td}>https://feedown-worker.xxx.workers.dev</td>
                  <td style={styles.td}></td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Local Development */}
          <section id="local-dev" style={styles.section}>
            <h2 style={styles.sectionTitle}>
              {language === 'en' ? 'Local Development' : 'ローカル開発環境'}
            </h2>

            <p style={styles.paragraph}>
              {language === 'en'
                ? 'Run two terminals for local development:'
                : 'ローカル開発には2つのターミナルが必要:'}
            </p>

            <div style={styles.stepTitle}>
              <span style={styles.stepNumber}>1</span>
              {language === 'en' ? 'Vite Dev Server' : 'Vite開発サーバー'}
            </div>
            <div style={styles.codeBlock}>
              <code style={styles.code}>
{`npm run dev:web
# => http://localhost:5173`}
              </code>
            </div>

            <div style={styles.stepTitle}>
              <span style={styles.stepNumber}>2</span>
              {language === 'en' ? 'Wrangler Pages (API)' : 'Wrangler Pages（API）'}
            </div>
            <div style={styles.codeBlock}>
              <code style={styles.code}>
{`cd apps/web
npx wrangler pages dev dist \\
  --compatibility-date=2024-01-01 \\
  --compatibility-flags=nodejs_compat \\
  --binding SUPABASE_URL=https://xxxxx.supabase.co \\
  --binding SUPABASE_ANON_KEY=your-anon-key \\
  --binding SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \\
  --binding WORKER_URL=https://feedown-worker.xxx.workers.dev
# => http://localhost:8788`}
              </code>
            </div>
          </section>

          {/* Mobile App */}
          <section id="mobile" style={styles.section}>
            <h2 style={styles.sectionTitle}>
              {language === 'en' ? 'Mobile App Build' : 'モバイルアプリビルド'}
            </h2>

            <div style={styles.stepTitle}>
              <span style={styles.stepNumber}>1</span>
              {language === 'en' ? 'Setup EAS CLI' : 'EAS CLIセットアップ'}
            </div>
            <div style={styles.codeBlock}>
              <code style={styles.code}>
{`npm install -g eas-cli
eas login`}
              </code>
            </div>

            <div style={styles.stepTitle}>
              <span style={styles.stepNumber}>2</span>
              {language === 'en' ? 'Build' : 'ビルド'}
            </div>
            <div style={styles.codeBlock}>
              <code style={styles.code}>
{`cd apps/mobile

# iOS
eas build --profile preview --platform ios

# Android (APK)
eas build --profile preview --platform android

# Development with Expo Go
npx expo start --clear`}
              </code>
            </div>

            <div style={styles.stepTitle}>
              <span style={styles.stepNumber}>3</span>
              {language === 'en' ? 'Connect Mobile App' : 'モバイルアプリ接続'}
            </div>
            <p style={styles.paragraph}>
              {language === 'en'
                ? 'When launching the mobile app, enter:'
                : 'モバイルアプリ起動時に入力:'}
            </p>
            <ul style={styles.list}>
              <li style={styles.listItem}>
                <strong>Server URL:</strong> {language === 'en' ? 'Your Pages URL (e.g., ' : 'あなたのPages URL（例: '}
                <code style={styles.inlineCode}>https://feedown.pages.dev</code>)
              </li>
              <li style={styles.listItem}>
                <strong>Email/Password:</strong> {language === 'en' ? 'Account created on web' : 'Webで作成したアカウント'}
              </li>
            </ul>
          </section>

          {/* Troubleshooting */}
          <section id="troubleshooting" style={styles.section}>
            <h2 style={styles.sectionTitle}>
              {language === 'en' ? 'Troubleshooting' : 'トラブルシューティング'}
            </h2>

            <div style={{ ...styles.note, backgroundColor: isDarkMode ? '#2d1a1a' : '#fff0f0', borderColor: isDarkMode ? '#660000' : '#ff6b6b' }}>
              <div style={{ ...styles.noteTitle, color: isDarkMode ? '#ff6b6b' : '#cc0000' }}>
                API 405 Error
              </div>
              <p style={{ ...styles.paragraph, marginBottom: 0 }}>
                <strong>{language === 'en' ? 'Cause:' : '原因:'}</strong> {language === 'en' ? 'Deployed from apps/web directory' : 'apps/webディレクトリからデプロイした'}
              </p>
              <p style={{ ...styles.paragraph, marginBottom: 0, marginTop: '8px' }}>
                <strong>{language === 'en' ? 'Solution:' : '解決:'}</strong> {language === 'en' ? 'Deploy from root directory' : 'ルートディレクトリからデプロイする'}
              </p>
            </div>

            <div style={{ ...styles.note, backgroundColor: isDarkMode ? '#2d1a1a' : '#fff0f0', borderColor: isDarkMode ? '#660000' : '#ff6b6b' }}>
              <div style={{ ...styles.noteTitle, color: isDarkMode ? '#ff6b6b' : '#cc0000' }}>
                RLS Error
              </div>
              <p style={{ ...styles.paragraph, marginBottom: 0 }}>
                <strong>{language === 'en' ? 'Cause:' : '原因:'}</strong> {language === 'en' ? 'RLS policies not configured' : 'RLSポリシーが未設定'}
              </p>
              <p style={{ ...styles.paragraph, marginBottom: 0, marginTop: '8px' }}>
                <strong>{language === 'en' ? 'Solution:' : '解決:'}</strong> {language === 'en' ? 'Run RLS SQL commands above' : '上記のRLS SQLコマンドを実行'}
              </p>
            </div>

            <div style={{ ...styles.note, backgroundColor: isDarkMode ? '#2d1a1a' : '#fff0f0', borderColor: isDarkMode ? '#660000' : '#ff6b6b' }}>
              <div style={{ ...styles.noteTitle, color: isDarkMode ? '#ff6b6b' : '#cc0000' }}>
                {language === 'en' ? 'Articles Not Showing' : '記事が表示されない'}
              </div>
              <p style={{ ...styles.paragraph, marginBottom: 0 }}>
                <strong>{language === 'en' ? 'Solution:' : '解決:'}</strong>
              </p>
              <ol style={{ ...styles.list, marginBottom: 0, marginTop: '8px' }}>
                <li>{language === 'en' ? 'Clear browser cache (Ctrl+Shift+R)' : 'ブラウザキャッシュをクリア（Ctrl+Shift+R）'}</li>
                <li>{language === 'en' ? 'Click Refresh button manually' : '手動でRefreshボタンをクリック'}</li>
              </ol>
            </div>
          </section>

          {/* Web App Preview */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>
              {language === 'en' ? 'Web App Preview' : 'Webアプリプレビュー'}
            </h2>
            <p style={styles.paragraph}>
              {language === 'en'
                ? 'Here\'s what your self-hosted FeedOwn will look like:'
                : 'セルフホストしたFeedOwnの見た目:'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div>
                <img src={webApp1} alt="Login" style={styles.screenshot} />
                <p style={styles.screenshotCaption}>{language === 'en' ? 'Login Screen' : 'ログイン画面'}</p>
              </div>
              <div>
                <img src={webApp2} alt="Dashboard" style={styles.screenshot} />
                <p style={styles.screenshotCaption}>{language === 'en' ? 'Dashboard - Article List' : 'ダッシュボード - 記事一覧'}</p>
              </div>
              <div>
                <img src={webApp3} alt="Article Detail" style={styles.screenshot} />
                <p style={styles.screenshotCaption}>{language === 'en' ? 'Article Detail' : '記事詳細'}</p>
              </div>
              <div>
                <img src={webApp4} alt="Feed Management" style={styles.screenshot} />
                <p style={styles.screenshotCaption}>{language === 'en' ? 'Feed Management' : 'フィード管理'}</p>
              </div>
            </div>
          </section>

          {/* GitHub Link */}
          <section style={{ ...styles.section, textAlign: 'center', padding: '40px', backgroundColor: isDarkMode ? '#1a1a1a' : '#f8f9fa', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>
              {t.viewFullGuide}
            </h3>
            <p style={{ ...styles.paragraph, marginBottom: '20px' }}>
              {t.fullGuideDesc}
            </p>
            <a
              href="https://github.com/kiyohken2000/feedown/blob/main/docs/SETUP.md"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                borderRadius: '8px',
                backgroundColor: '#FF6B35',
                color: '#fff',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              {language === 'en' ? 'View on GitHub' : 'GitHubで見る'} →
            </a>
          </section>
        </main>
      </div>

      <Footer />
    </div>
  );
}
