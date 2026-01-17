export const translations = {
  en: {
    // Header
    header: {
      home: 'Home',
      docs: 'Docs',
      setup: 'Self-Host',
      login: 'Login',
      getStarted: 'Get Started',
    },
    // Landing Page
    landing: {
      tagline: 'Own your feeds, own your data',
      description: 'A beautiful, self-hosted RSS reader that puts you in control. No tracking, no ads, just your content.',
      getStarted: 'Get Started',
      viewDocs: 'View Documentation',
      tryDemo: 'Try Demo',
      // Features
      featuresTitle: 'Everything you need',
      featuresSubtitle: 'A modern RSS reader with all the features you expect',
      feature1Title: 'Aggregate RSS Feeds',
      feature1Desc: 'Subscribe to your favorite blogs, news sites, and podcasts. All your content in one place.',
      feature2Title: 'Save Favorites',
      feature2Desc: 'Star articles to read later. Your favorites are saved forever, even after articles expire.',
      feature3Title: 'Dark Mode',
      feature3Desc: 'Easy on the eyes. Switch between light and dark themes with one click.',
      feature4Title: 'Self-Hosted',
      feature4Desc: 'Your data stays yours. Host on your own Cloudflare and Supabase accounts for free.',
      // Screenshot
      screenshotTitle: 'Clean, Modern Interface',
      screenshotSubtitle: 'Designed for distraction-free reading',
      // Mobile App
      mobileTitle: 'Read Anywhere',
      mobileSubtitle: 'Take your feeds with you on iOS and Android',
      mobileLogin: 'Login',
      mobileSignup: 'Sign Up',
      mobileArticles1: 'Article List',
      mobileArticles2: 'Dark Mode',
      mobileArticle: 'Article Detail',
      mobileReader: 'Reader Mode',
      mobileFeeds: 'Feed Management',
      mobileSettings: 'Settings',
      mobileDesc: 'The FeedOwn mobile app gives you access to all your feeds on the go. Available for iOS and Android with full feature parity including dark mode and Reader Mode.',
      mobileAppStore: 'App Store',
      mobileGooglePlay: 'Google Play',
      // Self-host
      selfHostTitle: 'Host It Yourself',
      selfHostDesc: 'FeedOwn is open source. Deploy your own instance on Cloudflare Pages and Supabase in minutes.',
      selfHostButton: 'View Setup Guide',
      // CTA
      ctaTitle: 'Ready to take control?',
      ctaDesc: 'Start reading your feeds without ads or tracking.',
      ctaButton: 'Create Free Account',
    },
    // Docs Page
    docs: {
      title: 'Documentation',
      subtitle: 'Learn how to use FeedOwn',
      // Sidebar
      gettingStarted: 'Getting Started',
      whatIs: 'What is FeedOwn?',
      quickStart: 'Quick Start',
      // Usage
      usage: 'Basic Usage',
      addingFeeds: 'Adding Feeds',
      readingArticles: 'Reading Articles',
      favorites: 'Favorites',
      darkMode: 'Dark Mode',
      // Mobile
      mobile: 'Mobile App',
      mobileSetup: 'Setup',
      mobileFeatures: 'Features',
      // FAQ
      faq: 'FAQ',
      // Content
      whatIsTitle: 'What is FeedOwn?',
      whatIsContent: 'FeedOwn is a self-hosted RSS reader that lets you aggregate content from your favorite websites. Unlike other RSS readers, FeedOwn gives you complete control over your data by allowing you to host it on your own infrastructure.',
      quickStartTitle: 'Quick Start',
      quickStartStep1: 'Create an account or sign in',
      quickStartStep2: 'Go to the Feeds page',
      quickStartStep3: 'Add your first RSS feed URL',
      quickStartStep4: 'Click Refresh to fetch articles',
      addingFeedsTitle: 'Adding Feeds',
      addingFeedsContent: 'To add a new feed, go to the Feeds page and enter the RSS feed URL in the input field. Click "Add Feed" to subscribe. You can also click on any of the recommended feeds to add them with one click.',
      readingArticlesTitle: 'Reading Articles',
      readingArticlesContent: 'Your Dashboard shows all articles from your subscribed feeds, sorted by date. Click on any article to view its details. Articles are automatically marked as read when you scroll past them.',
      favoritesTitle: 'Favorites',
      favoritesContent: 'Click the star icon on any article to save it to your favorites. Favorites are kept forever, even after the original article expires (articles expire after 7 days).',
      darkModeTitle: 'Dark Mode',
      darkModeContent: 'Toggle dark mode from the Settings page. Your preference is saved and will be remembered across sessions.',
      mobileSetupTitle: 'Mobile App Setup',
      mobileSetupContent: 'Download the FeedOwn app from the App Store or Google Play. On first launch, enter your server URL (e.g., https://feedown.pages.dev) and sign in with your account.',
      mobileFeaturesTitle: 'Mobile Features',
      mobileFeaturesContent: 'The mobile app includes all features of the web app: feed management, article reading, favorites, dark mode, and Reader Mode for distraction-free reading.',
      faqTitle: 'Frequently Asked Questions',
      faq1Q: 'Is FeedOwn free?',
      faq1A: 'Yes! FeedOwn is free to use. You can use our hosted version or deploy your own instance for free using Cloudflare and Supabase free tiers.',
      faq2Q: 'How long are articles kept?',
      faq2A: 'Articles are kept for 7 days. After that, they are automatically deleted. However, any articles you favorite are kept forever.',
      faq3Q: 'Can I import feeds from another reader?',
      faq3A: 'Yes! You can import and export feeds using OPML format from the Feeds page. This allows easy migration from other RSS readers.',
      faq4Q: 'Is there a limit on feeds?',
      faq4A: 'Regular accounts can have up to 100 feeds. Test accounts are limited to 3 feeds.',
    },
    // Setup Guide
    setup: {
      title: 'Self-Hosting Guide',
      subtitle: 'Deploy FeedOwn on your own infrastructure',
      intro: 'This guide will walk you through setting up your own FeedOwn instance using Cloudflare and Supabase.',
      requirements: 'Requirements',
      requirementsList: [
        'A Supabase account (free tier available)',
        'A Cloudflare account (free tier available)',
        'Node.js v22 or later',
        'Git',
      ],
      step1Title: 'Step 1: Set up Supabase',
      step1Content: 'Create a new Supabase project and run the database schema SQL to create the required tables.',
      step2Title: 'Step 2: Deploy to Cloudflare Pages',
      step2Content: 'Build and deploy the web application to Cloudflare Pages. RSS fetching is handled directly by Pages Functions.',
      step3Title: 'Step 3: Configure Environment Variables',
      step3Content: 'Set up the required Supabase environment variables in your Cloudflare Pages project.',
      step4Title: 'Step 4: Start Using',
      step4Content: 'Create an account, add your favorite RSS feeds, and start reading.',
      viewFullGuide: 'View Full Setup Guide',
      fullGuideDesc: 'For detailed instructions including SQL schemas and troubleshooting, see the full setup documentation.',
    },
    // Footer
    footer: {
      madeWith: 'Made with',
      by: 'by',
      openSource: 'Open Source',
      github: 'GitHub',
      docs: 'Documentation',
      license: 'MIT License',
    },
    // Common
    common: {
      learnMore: 'Learn More',
      backToHome: 'Back to Home',
    },
  },
  ja: {
    // Header
    header: {
      home: 'ホーム',
      docs: 'ドキュメント',
      setup: 'セルフホスト',
      login: 'ログイン',
      getStarted: '始める',
    },
    // Landing Page
    landing: {
      tagline: 'フィードもデータも、自分のものに',
      description: '美しくセルフホスト可能なRSSリーダー。トラッキングなし、広告なし、あなたのコンテンツだけ。',
      getStarted: '始める',
      viewDocs: 'ドキュメントを見る',
      tryDemo: 'デモを試す',
      // Features
      featuresTitle: '必要な機能がすべて揃う',
      featuresSubtitle: 'モダンなRSSリーダーに期待するすべての機能',
      feature1Title: 'RSSフィードを集約',
      feature1Desc: 'お気に入りのブログ、ニュースサイト、ポッドキャストを購読。すべてのコンテンツを一箇所で。',
      feature2Title: 'お気に入り保存',
      feature2Desc: '記事にスターを付けて後で読む。記事が期限切れになっても、お気に入りは永久保存。',
      feature3Title: 'ダークモード',
      feature3Desc: '目に優しい。ワンクリックでライト/ダークテーマを切り替え。',
      feature4Title: 'セルフホスト',
      feature4Desc: 'データは自分のもの。CloudflareとSupabaseの無料枠で自分のインスタンスをホスト。',
      // Screenshot
      screenshotTitle: 'クリーンでモダンなインターフェース',
      screenshotSubtitle: '集中して読書するためにデザイン',
      // Mobile App
      mobileTitle: 'どこでも読める',
      mobileSubtitle: 'iOSとAndroidでフィードを持ち歩こう',
      mobileLogin: 'ログイン',
      mobileSignup: 'サインアップ',
      mobileArticles1: '記事一覧',
      mobileArticles2: 'ダークモード',
      mobileArticle: '記事詳細',
      mobileReader: 'リーダーモード',
      mobileFeeds: 'フィード管理',
      mobileSettings: '設定',
      mobileDesc: 'FeedOwnモバイルアプリで、外出先でもすべてのフィードにアクセス。ダークモードやリーダーモードを含む全機能をiOSとAndroidで。',
      mobileAppStore: 'App Store',
      mobileGooglePlay: 'Google Play',
      // Self-host
      selfHostTitle: '自分でホストする',
      selfHostDesc: 'FeedOwnはオープンソース。Cloudflare PagesとSupabaseに数分でデプロイ。',
      selfHostButton: 'セットアップガイドを見る',
      // CTA
      ctaTitle: 'コントロールを取り戻す準備はできましたか？',
      ctaDesc: '広告やトラッキングなしでフィードを読み始めましょう。',
      ctaButton: '無料アカウントを作成',
    },
    // Docs Page
    docs: {
      title: 'ドキュメント',
      subtitle: 'FeedOwnの使い方を学ぶ',
      // Sidebar
      gettingStarted: 'はじめに',
      whatIs: 'FeedOwnとは？',
      quickStart: 'クイックスタート',
      // Usage
      usage: '基本的な使い方',
      addingFeeds: 'フィードの追加',
      readingArticles: '記事を読む',
      favorites: 'お気に入り',
      darkMode: 'ダークモード',
      // Mobile
      mobile: 'モバイルアプリ',
      mobileSetup: 'セットアップ',
      mobileFeatures: '機能',
      // FAQ
      faq: 'よくある質問',
      // Content
      whatIsTitle: 'FeedOwnとは？',
      whatIsContent: 'FeedOwnは、お気に入りのウェブサイトのコンテンツを集約できるセルフホスト型RSSリーダーです。他のRSSリーダーとは異なり、FeedOwnは自分のインフラでホストできるため、データを完全にコントロールできます。',
      quickStartTitle: 'クイックスタート',
      quickStartStep1: 'アカウントを作成またはサインイン',
      quickStartStep2: 'フィードページに移動',
      quickStartStep3: '最初のRSSフィードURLを追加',
      quickStartStep4: '更新ボタンをクリックして記事を取得',
      addingFeedsTitle: 'フィードの追加',
      addingFeedsContent: '新しいフィードを追加するには、フィードページに移動し、入力欄にRSSフィードのURLを入力します。「フィードを追加」をクリックして購読します。おすすめのフィードをワンクリックで追加することもできます。',
      readingArticlesTitle: '記事を読む',
      readingArticlesContent: 'ダッシュボードには、購読中のフィードからのすべての記事が日付順で表示されます。記事をクリックすると詳細が表示されます。スクロールすると記事は自動的に既読になります。',
      favoritesTitle: 'お気に入り',
      favoritesContent: '記事のスターアイコンをクリックしてお気に入りに保存します。お気に入りは、元の記事が期限切れになっても（記事は7日後に期限切れ）永久に保存されます。',
      darkModeTitle: 'ダークモード',
      darkModeContent: '設定ページからダークモードを切り替えられます。設定は保存され、セッション間で記憶されます。',
      mobileSetupTitle: 'モバイルアプリのセットアップ',
      mobileSetupContent: 'App StoreまたはGoogle PlayからFeedOwnアプリをダウンロードします。初回起動時にサーバーURL（例：https://feedown.pages.dev）を入力し、アカウントでサインインします。',
      mobileFeaturesTitle: 'モバイル機能',
      mobileFeaturesContent: 'モバイルアプリにはWebアプリのすべての機能が含まれています：フィード管理、記事閲覧、お気に入り、ダークモード、集中して読むためのリーダーモード。',
      faqTitle: 'よくある質問',
      faq1Q: 'FeedOwnは無料ですか？',
      faq1A: 'はい！FeedOwnは無料で使用できます。ホストされたバージョンを使用するか、CloudflareとSupabaseの無料枠で自分のインスタンスを無料でデプロイできます。',
      faq2Q: '記事はどのくらい保存されますか？',
      faq2A: '記事は7日間保存されます。その後、自動的に削除されます。ただし、お気に入りに追加した記事は永久に保存されます。',
      faq3Q: '他のリーダーからフィードをインポートできますか？',
      faq3A: 'はい！フィード管理ページからOPML形式でフィードをインポート・エクスポートできます。これにより、他のRSSリーダーからの移行が簡単にできます。',
      faq4Q: 'フィードに制限はありますか？',
      faq4A: '通常のアカウントは最大100フィードまで。テストアカウントは3フィードに制限されています。',
    },
    // Setup Guide
    setup: {
      title: 'セルフホスティングガイド',
      subtitle: '自分のインフラにFeedOwnをデプロイ',
      intro: 'このガイドでは、CloudflareとSupabaseを使用して独自のFeedOwnインスタンスをセットアップする方法を説明します。',
      requirements: '必要なもの',
      requirementsList: [
        'Supabaseアカウント（無料枠あり）',
        'Cloudflareアカウント（無料枠あり）',
        'Node.js v22以上',
        'Git',
      ],
      step1Title: 'ステップ1: Supabaseのセットアップ',
      step1Content: '新しいSupabaseプロジェクトを作成し、データベーススキーマSQLを実行して必要なテーブルを作成します。',
      step2Title: 'ステップ2: Cloudflare Pagesへのデプロイ',
      step2Content: 'WebアプリケーションをビルドしてCloudflare Pagesにデプロイします。RSS取得はPages Functionsが直接行います。',
      step3Title: 'ステップ3: 環境変数の設定',
      step3Content: 'Cloudflare PagesプロジェクトでSupabaseの環境変数を設定します。',
      step4Title: 'ステップ4: 使い始める',
      step4Content: 'アカウントを作成し、お気に入りのRSSフィードを追加して、読み始めましょう。',
      viewFullGuide: '完全なセットアップガイドを見る',
      fullGuideDesc: 'SQLスキーマやトラブルシューティングを含む詳細な手順は、完全なセットアップドキュメントをご覧ください。',
    },
    // Footer
    footer: {
      madeWith: 'Made with',
      by: 'by',
      openSource: 'オープンソース',
      github: 'GitHub',
      docs: 'ドキュメント',
      license: 'MITライセンス',
    },
    // Common
    common: {
      learnMore: '詳しく見る',
      backToHome: 'ホームに戻る',
    },
  },
};

// Helper function to get translation
export function t(translations, language, key) {
  const keys = key.split('.');
  let value = translations[language];
  for (const k of keys) {
    if (value && value[k] !== undefined) {
      value = value[k];
    } else {
      // Fallback to English
      value = translations['en'];
      for (const k2 of keys) {
        if (value && value[k2] !== undefined) {
          value = value[k2];
        } else {
          return key; // Return key if not found
        }
      }
      break;
    }
  }
  return value;
}
