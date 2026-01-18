import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import PublicHeader from '../components/PublicHeader';
import Footer from '../components/Footer';

export default function PrivacyPolicyPage() {
  const { isDarkMode } = useTheme();
  const { language } = useLanguage();

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
      maxWidth: '800px',
      margin: '0 auto',
      padding: '40px 20px',
    },
    title: {
      fontSize: '36px',
      fontWeight: '700',
      marginBottom: '8px',
    },
    lastUpdated: {
      fontSize: '14px',
      color: isDarkMode ? '#888' : '#666',
      marginBottom: '40px',
    },
    section: {
      marginBottom: '32px',
    },
    sectionTitle: {
      fontSize: '20px',
      fontWeight: '600',
      marginBottom: '12px',
      color: isDarkMode ? '#e0e0e0' : '#333',
    },
    paragraph: {
      fontSize: '16px',
      lineHeight: '1.8',
      color: isDarkMode ? '#b0b0b0' : '#555',
      marginBottom: '12px',
    },
    list: {
      paddingLeft: '24px',
      marginBottom: '12px',
    },
    listItem: {
      fontSize: '16px',
      lineHeight: '1.8',
      color: isDarkMode ? '#b0b0b0' : '#555',
      marginBottom: '8px',
    },
    backLink: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '40px',
      color: '#FF6B35',
      textDecoration: 'none',
      fontSize: '14px',
    },
    supportSection: {
      marginBottom: '32px',
      padding: '24px',
      backgroundColor: isDarkMode ? '#1e3a2f' : '#e8f5e9',
      borderRadius: '12px',
      borderLeft: '4px solid #4CAF50',
    },
    supportTitle: {
      fontSize: '22px',
      fontWeight: '700',
      marginBottom: '16px',
      color: isDarkMode ? '#81c784' : '#2e7d32',
    },
    supportEmail: {
      display: 'inline-block',
      color: '#FF6B35',
      fontWeight: '600',
    },
  };

  const content = {
    en: {
      title: 'Privacy Policy & Support',
      lastUpdated: 'Last updated: January 2025',
      intro: 'FeedOwn ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our RSS reader application.',
      sections: [
        {
          title: 'Support',
          isSupport: true,
          content: [
            {
              type: 'paragraph',
              text: 'Need help or have questions? We are here to assist you.',
            },
            {
              type: 'list',
              items: [
                'Email: retwpay@gmail.com',
                'GitHub Issues: https://github.com/kiyohken2000/feedown/issues',
              ],
            },
            {
              type: 'paragraph',
              text: 'We typically respond within 24-48 hours. For bug reports, please include your device information and steps to reproduce the issue.',
            },
          ],
        },
        {
          title: '1. Information We Collect',
          content: [
            { type: 'paragraph', text: 'We collect the following types of information:' },
            {
              type: 'list',
              items: [
                'Account Information: Email address and password when you create an account',
                'Feed Data: RSS feed URLs you subscribe to',
                'Usage Data: Articles you read, favorites you save, and your reading preferences',
                'Device Information: Basic device information for app functionality',
              ],
            },
          ],
        },
        {
          title: '2. How We Use Your Information',
          content: [
            { type: 'paragraph', text: 'We use the collected information to:' },
            {
              type: 'list',
              items: [
                'Provide and maintain the RSS reader service',
                'Sync your feeds and articles across devices',
                'Save your favorites and reading preferences',
                'Improve our service and user experience',
              ],
            },
          ],
        },
        {
          title: '3. Data Storage',
          content: [
            {
              type: 'paragraph',
              text: 'Your data is stored securely using Supabase (PostgreSQL database). If you self-host FeedOwn, your data is stored in your own Supabase instance, giving you complete control over your information.',
            },
            {
              type: 'paragraph',
              text: 'Articles are automatically deleted after 7 days, except for articles you have saved to favorites, which are kept indefinitely.',
            },
          ],
        },
        {
          title: '4. Data Sharing',
          content: [
            { type: 'paragraph', text: 'We do not sell, trade, or share your personal information with third parties. Your data is only used to provide the FeedOwn service.' },
            {
              type: 'list',
              items: [
                'We do not use advertising or tracking services',
                'We do not share your reading habits with anyone',
                'RSS feeds are fetched through our proxy server only to avoid CORS issues',
              ],
            },
          ],
        },
        {
          title: '5. Your Rights',
          content: [
            { type: 'paragraph', text: 'You have the right to:' },
            {
              type: 'list',
              items: [
                'Access your personal data',
                'Delete your account and all associated data',
                'Export your feed subscriptions',
                'Self-host FeedOwn for complete data ownership',
              ],
            },
          ],
        },
        {
          title: '6. Security',
          content: [
            {
              type: 'paragraph',
              text: 'We implement appropriate security measures to protect your data, including encrypted connections (HTTPS), secure authentication, and Row Level Security (RLS) in our database.',
            },
          ],
        },
        {
          title: '7. Open Source',
          content: [
            {
              type: 'paragraph',
              text: 'FeedOwn is open source software. You can review our code on GitHub to verify how we handle your data. You can also self-host the entire application for complete privacy and data ownership.',
            },
          ],
        },
        {
          title: '8. Contact',
          content: [
            {
              type: 'paragraph',
              text: 'If you have questions about this Privacy Policy or need support, please see the Support section at the top of this page.',
            },
          ],
        },
      ],
      backToHome: 'Back to Home',
    },
    ja: {
      title: 'プライバシーポリシー & サポート',
      lastUpdated: '最終更新日: 2025年1月',
      intro: 'FeedOwn（以下「当サービス」）は、お客様のプライバシーを保護することをお約束します。このプライバシーポリシーでは、RSSリーダーアプリケーションをご利用いただく際に、どのような情報を収集し、どのように使用・保護するかについて説明します。',
      sections: [
        {
          title: 'サポート',
          isSupport: true,
          content: [
            {
              type: 'paragraph',
              text: 'お困りのことやご質問がありましたら、お気軽にお問い合わせください。',
            },
            {
              type: 'list',
              items: [
                'メール: retwpay@gmail.com',
                'GitHub Issues: https://github.com/kiyohken2000/feedown/issues',
              ],
            },
            {
              type: 'paragraph',
              text: '通常24〜48時間以内にご返信いたします。バグ報告の際は、お使いのデバイス情報と再現手順をお知らせください。',
            },
          ],
        },
        {
          title: '1. 収集する情報',
          content: [
            { type: 'paragraph', text: '当サービスは以下の種類の情報を収集します：' },
            {
              type: 'list',
              items: [
                'アカウント情報：アカウント作成時のメールアドレスとパスワード',
                'フィードデータ：購読しているRSSフィードのURL',
                '利用データ：閲覧した記事、保存したお気に入り、読書設定',
                'デバイス情報：アプリの機能に必要な基本的なデバイス情報',
              ],
            },
          ],
        },
        {
          title: '2. 情報の利用目的',
          content: [
            { type: 'paragraph', text: '収集した情報は以下の目的で使用します：' },
            {
              type: 'list',
              items: [
                'RSSリーダーサービスの提供と維持',
                'デバイス間でのフィードと記事の同期',
                'お気に入りと読書設定の保存',
                'サービスとユーザー体験の改善',
              ],
            },
          ],
        },
        {
          title: '3. データの保存',
          content: [
            {
              type: 'paragraph',
              text: 'お客様のデータはSupabase（PostgreSQLデータベース）を使用して安全に保存されます。FeedOwnをセルフホストする場合、データはお客様自身のSupabaseインスタンスに保存され、情報を完全にコントロールできます。',
            },
            {
              type: 'paragraph',
              text: '記事は7日後に自動的に削除されます。ただし、お気に入りに保存した記事は無期限に保持されます。',
            },
          ],
        },
        {
          title: '4. データの共有',
          content: [
            { type: 'paragraph', text: '当サービスは、お客様の個人情報を第三者に販売、交換、共有することはありません。データはFeedOwnサービスの提供のみに使用されます。' },
            {
              type: 'list',
              items: [
                '広告やトラッキングサービスは使用していません',
                'お客様の閲覧習慣を誰とも共有しません',
                'RSSフィードはCORS問題を回避するためにのみプロキシサーバーを経由して取得されます',
              ],
            },
          ],
        },
        {
          title: '5. お客様の権利',
          content: [
            { type: 'paragraph', text: 'お客様には以下の権利があります：' },
            {
              type: 'list',
              items: [
                '個人データへのアクセス',
                'アカウントと関連するすべてのデータの削除',
                'フィード購読のエクスポート',
                '完全なデータ所有権のためのセルフホスト',
              ],
            },
          ],
        },
        {
          title: '6. セキュリティ',
          content: [
            {
              type: 'paragraph',
              text: '当サービスは、暗号化された接続（HTTPS）、安全な認証、データベースの行レベルセキュリティ（RLS）など、適切なセキュリティ対策を実施してお客様のデータを保護しています。',
            },
          ],
        },
        {
          title: '7. オープンソース',
          content: [
            {
              type: 'paragraph',
              text: 'FeedOwnはオープンソースソフトウェアです。GitHubでコードを確認し、データがどのように処理されているかを検証できます。また、完全なプライバシーとデータ所有権のために、アプリケーション全体をセルフホストすることも可能です。',
            },
          ],
        },
        {
          title: '8. お問い合わせ',
          content: [
            {
              type: 'paragraph',
              text: 'このプライバシーポリシーに関するご質問やサポートが必要な場合は、ページ上部のサポートセクションをご覧ください。',
            },
          ],
        },
      ],
      backToHome: 'ホームに戻る',
    },
  };

  const t = content[language];

  return (
    <div style={styles.page}>
      <PublicHeader />

      <div style={styles.container}>
        <h1 style={styles.title}>{t.title}</h1>
        <p style={styles.lastUpdated}>{t.lastUpdated}</p>
        <p style={styles.paragraph}>{t.intro}</p>

        {t.sections.map((section, idx) => (
          <section key={idx} style={section.isSupport ? styles.supportSection : styles.section}>
            <h2 style={section.isSupport ? styles.supportTitle : styles.sectionTitle}>{section.title}</h2>
            {section.content.map((item, itemIdx) => {
              if (item.type === 'paragraph') {
                return <p key={itemIdx} style={styles.paragraph}>{item.text}</p>;
              }
              if (item.type === 'list') {
                return (
                  <ul key={itemIdx} style={styles.list}>
                    {item.items.map((listItem, listIdx) => (
                      <li key={listIdx} style={styles.listItem}>{listItem}</li>
                    ))}
                  </ul>
                );
              }
              return null;
            })}
          </section>
        ))}

        <Link to="/" style={styles.backLink}>
          ← {t.backToHome}
        </Link>
      </div>

      <Footer />
    </div>
  );
}
