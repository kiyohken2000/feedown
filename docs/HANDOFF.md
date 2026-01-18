# FeedOwn 引継ぎドキュメント

**最終更新**: 2026-01-18
**ステータス**: Phase 13進行中、App Store / Google Play 公開済み

---

## 現在の状態

### プロジェクト概要
FeedOwnはセルフホスト可能なRSSリーダーです。Web版とモバイルアプリ（iOS/Android）を提供しています。

### 公開URL
| プラットフォーム | URL |
|-----------------|-----|
| **Web** | https://feedown.pages.dev |
| **App Store** | https://apps.apple.com/us/app/feedown/id6757896656 |
| **Google Play** | https://play.google.com/store/apps/details?id=net.votepurchase.feedown |

### 完了した作業
- Firebase → Supabase 完全移行
- 全APIエンドポイントがSupabase PostgreSQLで動作
- Supabase Authによる認証
- Web UIが本番環境で稼働中
- Expoモバイルアプリ: 全機能実装完了
- App Store / Google Play 公開完了
- ランディングページにモバイルアプリ紹介セクション追加
- RSSパーサー: RSS 2.0 / RSS 1.0 (RDF) / Atom 対応
- **フィードごとの記事一覧表示**: Web/Mobile両方でフィード選択ドロップダウン追加
- **OPMLインポート/エクスポート（Web版）**: FeedsPageでOPML形式のインポート・エクスポートに対応
- **記事の共有機能（Mobile版）**: ArticleDetailヘッダーにShareボタン追加
- **フォントサイズ変更（Mobile版）**: Reader Modeのフォントサイズを設定画面から変更可能

### デプロイ情報
- **本番URL（Web）**: https://feedown.pages.dev
- **Cloudflare Pages Project**: feedown
- **Supabase Project**: feedown（ダッシュボードで確認）
- **EAS Project ID**: 09e91d3a-0014-4831-b35f-9962d05db0e3

### デプロイ手順

```bash
# Web版デプロイ（ルートディレクトリから実行すること！）
cd /path/to/feedown
npm run build --workspace=apps/web
npx wrangler pages deploy apps/web/dist --project-name=feedown
```

**重要**: `apps/web`ディレクトリからではなく、**ルートディレクトリから**デプロイすること。
そうしないとfunctionsフォルダが含まれず、APIが405エラーになる。

---

## 既知のバグ・未解決問題

### 1. モバイルアプリが約1時間経過するとunauthorizedエラーが発生 🟢 解決済み

**症状**: 記事一覧、フィード画面、お気に入り画面で401 Unauthorizedエラーが発生。ログインし直すと解消。

**原因**: Supabaseの`access_token`は約1時間で期限切れになるが、`refresh_token`を保存・使用していなかった。

**解決方法**:
- トークンリフレッシュAPIを新規作成（`/api/auth/refresh`）
- モバイルアプリで`refresh_token`を保存し、401エラー時に自動リフレッシュ
- 詳細は「本日の作業内容」セクション参照

### 2. Clear All Data 後に記事が表示されたままになる問題 🟢 解決済み

**症状**: Settings画面で「Clear All Data」を実行すると、FavoritesとFeedsは削除されるが、Articlesタブに記事が表示されたままになる。

**原因**: フロントエンドのキャッシュ（React state）が残っている。

**解決方法**: タブ/ページにフォーカスが当たったら自動でリフレッシュ
- **Mobile**: `useFocusEffect` で対応（`apps/mobile/src/scenes/home/Home.js`）
- **Web**: `location.pathname` 監視 + `visibilitychange` で対応（`apps/web/src/pages/DashboardPage.jsx`）

### 3. Favorites リロード後にデータが消える問題 🟢 解決済み

**症状**: Favoritesに追加した記事が、アプリをリロードするとサムネイル画像とフィード名以外が消える（タイトル、説明文、URLが表示されない）。

**原因**: APIレスポンスとフロントエンドの期待するフィールド名が不一致だった。

| API返却値（旧） | フロントエンド期待値 |
|----------------|---------------------|
| `articleTitle` | `title` |
| `articleDescription` | `description` |
| `articleLink` | `url` |
| `savedAt` | `createdAt` |

初回追加時はオプティミスティック更新で正しい形式が使われるため表示されるが、リロード後はAPIから取得したデータがそのまま使われるため不一致が発生。

**解決方法**:
- `functions/api/favorites.ts`: APIレスポンスのフィールド名を修正
- `apps/web/src/pages/FavoritesPage.jsx`: 新しいフィールド名に対応

---

## 本日の作業内容（2026-01-18）

### 1. フィードごとの記事一覧表示（Web版）

**概要**: 特定のフィードの記事のみを表示する機能を追加

**変更ファイル**: `apps/web/src/pages/DashboardPage.jsx`

**実装内容**:
- `selectedFeedId` stateを追加
- フィード選択ドロップダウンを追加（All/Unread/Readフィルターの左側）
- `fetchArticles`に`feedId`パラメータを追加
- フィード変更時に記事を自動再取得
- Mark All Read時にも選択中フィードを維持

**UI**:
```
[All Feeds ▼]  [All] [Unread] [Read]    [✓ Mark All Read] [🔄 Refresh]
```

**備考**:
- APIは既に`feedId`パラメータをサポート済み（`/api/articles?feedId=xxx`）
- フロントエンドのみの変更で完結
- Mobile版は未実装（Phase 13で予定）

### 2. OPMLインポート/エクスポート機能（Web版）

**概要**: 他のRSSリーダーとの相互運用のためにOPML形式でのフィードインポート/エクスポート機能を追加

**変更ファイル**: `apps/web/src/pages/FeedsPage.jsx`

**実装内容**:
- `handleExportOPML`: 登録済みフィードをOPML 2.0形式でダウンロード
- `handleImportOPML`: OPMLファイルを読み込み、フィードを一括登録
- XMLエスケープ用の`escapeXml`ヘルパー関数
- Import/Exportボタンを「Your Feeds」セクションに追加

**UI**:
```
Your Feeds (N)                    [Import OPML] [Export OPML]
```

**機能詳細**:
- **エクスポート**: 全フィードを`feedown-subscriptions-YYYY-MM-DD.opml`としてダウンロード
- **インポート**: `.opml`または`.xml`ファイルを選択し、重複を除いて新規フィードのみ追加
- インポート中は進捗表示、成功/失敗件数をトースト通知

**備考**:
- OPMLインポート時はタイトル情報もAPIに渡すように実装
- Mobile版は未実装（ファイル操作が煩雑なため不要と判断）

### 3. フィード追加時のタイトル取得修正

**問題**: フィードを追加すると「Untitled Feed」になる

**原因**: `functions/api/feeds/index.ts`がWorker URL経由でRSSを取得しようとしていたが、Worker URLが設定されていなかった

**修正**:
- Worker URL経由ではなく、`refresh.ts`と同様に直接RSSを取得するように変更
- `packages/shared/src/api/endpoints.ts`: `feeds.add(url, title?)`にオプションのtitleパラメータを追加

### 4. Web版UI改善: アイコン追加 & ナビゲーション統一

**概要**: `react-icons`ライブラリを導入し、ナビゲーションとボタンにアイコンを追加

**変更ファイル**:
- `apps/web/package.json`: `react-icons`追加
- `apps/web/src/components/Navigation.jsx`: ナビゲーションにアイコン追加、順序変更
- `apps/web/src/components/ArticleModal.jsx`: ボタンにアイコン追加
- `apps/web/src/pages/DashboardPage.jsx`: ボタンにアイコン追加、Scroll to Topボタン追加

**実装内容**:
- ナビゲーション: Dashboard(📰)、Favorites(⭐)、Feeds(📡)、Settings(⚙️)
- ナビゲーションの順序をモバイル版と統一（Favorites → Feeds）
- Dashboardボタン: Mark All Read(✓)、Refresh(🔄)、Top(↑)
- 記事モーダルボタン: Mark as Read(✓)、Add to Favorites(☆/★)、Visit Original(↗)
- 「Top」ボタンでスクロール位置を一番上に戻す機能を追加

### 5. Mobile版 フィードごとの記事一覧表示

**概要**: Home画面でフィードを選択して記事をフィルタリングする機能を追加

**変更ファイル**:
- `apps/mobile/package.json`: `react-native-element-dropdown` 追加
- `apps/mobile/src/scenes/home/Home.js`: ドロップダウン追加

**実装内容**:
- ヘッダー右側にフィード選択ドロップダウンを追加
- 「All Feeds」または特定のフィードを選択可能
- 選択したフィードの記事のみ表示

### 6. Mobile版 記事の共有機能

**概要**: 記事詳細画面から記事をシェアする機能を追加

**変更ファイル**: `apps/mobile/src/scenes/article/ArticleDetail.js`

**実装内容**:
- ヘッダーに「Share」ボタンを追加
- React Native の Share モジュールを使用
- タイトルとURLを共有

### 7. Mobile版 フォントサイズ変更

**概要**: Reader Modeのフォントサイズを設定画面から変更可能にする機能を追加

**変更ファイル**:
- `apps/mobile/src/contexts/ThemeContext.js`: fontSize設定を追加（Small/Medium/Large/Extra Large）
- `apps/mobile/src/components/ArticleReader.js`: 動的フォントサイズを適用
- `apps/mobile/src/scenes/profile/Profile.js`: 「Reader」セクションにフォントサイズ選択UI追加

**実装内容**:
- ThemeContextに`readerFontSize`、`setFontSize`、`getFontSizeConfig`を追加
- AsyncStorageに設定を永続化
- Profile画面に4つのサイズオプションを表示（ボタン式）

---

## 以前の作業内容（2026-01-16）

### 1. モバイルアプリ トークンリフレッシュ機能

**問題**: モバイルアプリが約1時間経過するとunauthorizedエラーが発生する
- 記事一覧、フィード画面、お気に入り画面で発生
- ログインし直すと解消する

**原因**: Supabaseの`access_token`は約1時間で期限切れになるが、`refresh_token`を保存・使用していなかった

**修正内容**:

1. **新規APIエンドポイント** (`functions/api/auth/refresh.ts`)
   - `POST /api/auth/refresh`
   - `refreshToken`を受け取り、新しい`access_token`と`refresh_token`を返す

2. **ログイン/登録APIの修正** (`functions/api/auth/login.ts`, `register.ts`)
   - レスポンスに`refreshToken`を追加

3. **モバイルアプリ ストレージ更新** (`apps/mobile/src/utils/supabase.js`)
   - `getRefreshToken()`, `saveRefreshToken()` 関数追加
   - `clearAuthData()`で`refreshToken`も削除

4. **APIクライアント更新** (`apps/mobile/src/utils/api.js`)
   - `ApiClient.refreshToken()` メソッド追加
   - `request()`で401エラー時に自動でトークンをリフレッシュしてリトライ

5. **UserContext更新** (`apps/mobile/src/contexts/UserContext.js`)
   - `signIn()`, `signUp()`で`refreshToken`を保存

**注意**:
- 既存ユーザーは一度ログアウトして再ログインすることで`refreshToken`が保存される
- モバイルアプリの変更を反映するには再ビルドが必要

### 2. Recommended Feeds キャッシュ問題修正

**問題**: Pythonスクリプトでおすすめフィードを更新しても、Web版で反映されるまで時間がかかる

**原因**: `Cache-Control: public, max-age=3600`が設定されていて、ブラウザが1時間キャッシュしていた

**修正** (`functions/api/recommended-feeds.ts`):
```javascript
headers: {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
}
```

### 3. RDF形式（RSS 1.0）のサポート追加

**問題**: 一部のRSSフィードで記事が表示されない
- CNN (.rdf)、National Geographic (.rdf)、CNET Japan (.rdf)、PC Watch (.rdf)、朝日新聞 (.rdf)、FC2ブログ等

**原因**: `functions/api/refresh.ts`の`parseRssXml`関数がRSS 2.0形式のみ対応していた
- RSS 2.0: `<item>`が`<channel>`の**中**にある
- RSS 1.0 (RDF): `<item>`が`<channel>`の**外側**（`<rdf:RDF>`直下）にある

**修正内容** (`functions/api/refresh.ts:243-326`):
```javascript
const isRdf = xmlText.includes('<rdf:RDF') || xmlText.includes('xmlns="http://purl.org/rss/1.0/"');

if (isRdf) {
  // RSS 1.0 (RDF) format - items are outside channel element
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
  while ((itemMatch = itemRegex.exec(xmlText)) !== null) {  // XML全体から検索
    // dc:date（RDF形式の日付）に対応
    const itemPubDate = itemXml.match(/<dc:date[^>]*>(.*?)<\/dc:date>/)?.[1] || ...
    // rdf:about属性をGUIDとして使用
    const rdfAbout = itemMatch[0].match(/<item[^>]*rdf:about="([^"]+)"/)?.[1];
  }
}
```

### 2. ランディングページ - モバイルアプリ紹介セクション

**追加した機能**:

1. **8枚のモバイルスクリーンショット表示** (`apps/web/src/pages/LandingPage.jsx`)
   - ログイン、サインアップ、記事一覧、ダークモード、記事詳細、リーダーモード、フィード管理、設定
   - レスポンシブグリッド（PC: 4列、タブレット: 2-3列、スマホ: 2列）
   - スクリーンショット画像: `apps/web/src/assets/images/mobile_screenshots/`

2. **画像クリックで拡大表示（ライトボックス）**
   - `useState`でモーダル管理
   - オーバーレイクリックまたは×ボタンで閉じる

3. **App Store / Google Play バッジリンク**
   - バッジ画像: `apps/web/src/assets/images/badges/`
   - App Store: https://apps.apple.com/us/app/feedown/id6757896656
   - Google Play: https://play.google.com/store/apps/details?id=net.votepurchase.feedown

4. **日英翻訳対応** (`apps/web/src/i18n/translations.js`)
   - `mobileTitle`, `mobileSubtitle`, `mobileDesc`, `mobileLogin`, `mobileSignup`, etc.

---

## 以前の作業内容

### ダークモード実装

1. **ThemeContext** (`contexts/ThemeContext.js`) - 新規作成
   - ダークモードの状態管理
   - AsyncStorageへの永続化（`@feedown_theme`キー）
   - `useTheme`フック提供（`isDarkMode`, `toggleDarkMode`）

2. **テーマカラー** (`theme/colors.js`)
   - `lightTheme` / `darkTheme` オブジェクト追加
   - `getThemeColors(isDarkMode)` ヘルパー関数追加
   - 背景、カード、テキスト、ボーダー、入力欄の色を定義

3. **対応した画面・コンポーネント**
   - `ScreenTemplate.js` - 背景色、StatusBar
   - `TextInputBox.js` - 入力欄の色
   - `Navigation.js` - トーストのダークモード対応
   - `Tabs.js` - ボトムタブナビゲーター
   - `Home.js`, `Favorites.js`, `Read.js`, `Profile.js`, `ArticleDetail.js`

4. **Settings画面** (`scenes/profile/Profile.js`)
   - Dark Modeトグルスイッチ追加
   - Appearanceセクション追加

### 以前の作業

1. **記事詳細画面** (`scenes/article/ArticleDetail.js`)
   - 記事タップで詳細画面に遷移
   - 詳細画面を開いたときに既読マーク
   - Add to Favorites / In Favoritesボタン
   - Visit Originalボタン（外部ブラウザで開く）

2. **お気に入り画面** (`scenes/favorites/Favorites.js`)
   - Favoritesタブ追加（星アイコン）
   - お気に入り一覧表示
   - 記事タップで詳細画面に遷移
   - 削除機能（確認ダイアログ付き）

3. **記事一覧画面の改善** (`scenes/home/Home.js`)
   - All/Unread/Readフィルター
   - Mark All Readボタン
   - 各記事に「Mark as Read」ボタン追加

4. **Settings画面** (`scenes/profile/Profile.js`, `apps/web/src/pages/SettingsPage.jsx`)
   - パスワードヒント追加: "If you didn't set a custom password, the default password is 111111"

5. **FeedsContext更新** (`contexts/FeedsContext.js`)
   - toggleFavoriteでfavorites配列も同時更新（オプティミスティック更新）
   - batchMarkAsRead関数追加

### ナビゲーション構成

ボトムタブ4つ:
- **Articles** (newspaper-o) - 記事一覧 → 記事詳細
- **Favorites** (star) - お気に入り一覧 → 記事詳細
- **Feeds** (rss) - フィード管理
- **Settings** (cog) - 設定

---

## モバイルアプリ（Phase 9-11） ✅ 完了・公開済み

### ストア公開URL
- **App Store**: https://apps.apple.com/us/app/feedown/id6757896656
- **Google Play**: https://play.google.com/store/apps/details?id=net.votepurchase.feedown

### 実装済み機能
- ✅ Supabase認証（サインイン、サインアップ、自動ログイン）
- ✅ サーバーURL入力機能（セルフホスト対応）
- ✅ Quick Create Test Account
- ✅ 記事一覧（All/Unread/Readフィルター、Mark All Read）
- ✅ 記事詳細 + Reader Mode
- ✅ お気に入り機能
- ✅ フィード管理（追加、削除、おすすめフィード）
- ✅ ダークモード対応
- ✅ プルトゥリフレッシュ、無限スクロール

### 主要バージョン
```json
{
  "expo": "~54.0.31",
  "expo-updates": "~29.0.16",
  "react-native": "0.81.5",
  "react-native-reanimated": "~4.1.0",
  "react-native-worklets": "0.5.1",
  "@supabase/supabase-js": "^2.45.0"
}
```

### モバイルアプリ起動手順

```bash
# Expo Go で起動
cd apps/mobile
npx expo start --clear

# EAS Build（iOS preview）
cd apps/mobile
eas build --profile preview --platform ios

# EAS Build（Android preview）
cd apps/mobile
eas build --profile preview --platform android
```

### モノレポ構成の注意点

1. **エントリポイント**: `apps/mobile/App.js`で`registerRootComponent`を直接呼び出し
2. **babel.config.js**: module-resolverでエイリアス設定済み（`utils`, `theme`, `components`等）
3. **reanimated/plugin**: 必ずプラグインリストの**最後**に配置

### 主要ファイル一覧（モバイル）

```
apps/mobile/src/
├── contexts/
│   ├── FeedsContext.js      # フィード・記事状態管理
│   ├── UserContext.js       # 認証状態管理
│   └── ThemeContext.js      # ダークモード状態管理
├── scenes/
│   ├── home/Home.js         # 記事一覧（フィルター、Mark All Read）
│   ├── article/ArticleDetail.js  # 記事詳細
│   ├── favorites/Favorites.js    # お気に入り一覧
│   ├── read/Read.js         # フィード管理
│   └── profile/Profile.js   # 設定
├── routes/navigation/
│   ├── tabs/Tabs.js         # ボトムタブ設定
│   └── stacks/
│       ├── HomeStacks.js    # Articles + ArticleDetail
│       ├── FavoritesStacks.js # Favorites + FavoriteDetail
│       └── ...
└── utils/
    ├── api.js               # APIクライアント（動的サーバーURL対応）
    └── supabase.js          # AsyncStorage管理（サーバーURL、認証トークン、ユーザー情報）
```

---

## 次の実装予定（Phase 13）

詳細は `docs/FEATURE_PLAN.md` を参照。

### 1. フィードごとの記事一覧表示

#### Web版 ✅ 完了（2026-01-18）
- `apps/web/src/pages/DashboardPage.jsx` にフィード選択ドロップダウン追加済み
- 本番デプロイ済み: https://feedown.pages.dev

#### Mobile版 📋 実装待ち
`react-native-element-dropdown` を使用してArticles画面（Home.js）にドロップダウンを追加する。

**変更予定ファイル（3つのみ）:**
| ファイル | 変更内容 |
|---------|----------|
| `apps/mobile/package.json` | `react-native-element-dropdown` 追加 |
| `apps/mobile/src/scenes/home/Home.js` | Dropdown追加、selectedFeedId state追加 |
| `apps/mobile/src/contexts/FeedsContext.js` | `fetchArticles`にfeedIdパラメータ追加 |

**インストールコマンド:**
```bash
yarn workspace mobile add react-native-element-dropdown
```

**実装の詳細は `docs/FEATURE_PLAN.md` の「Mobile版 実装計画」セクションを参照。**

### 2. 記事の共有機能
記事をSNSや他アプリに共有する機能。

**変更予定ファイル:**
- `apps/mobile/src/scenes/article/ArticleDetail.js` - Shareボタン追加
- `apps/mobile/src/components/ArticleReader.js` - Shareボタン追加
- `apps/web/src/components/ArticleModal.jsx` - Share/Copyボタン追加

### 3. フォントサイズ/フォント変更
リーダーモードのフォント設定をカスタマイズ可能にする。

**変更予定ファイル:**
- `apps/mobile/src/contexts/ThemeContext.js` - fontSize, fontFamily state追加
- `apps/mobile/src/components/ArticleReader.js` - 動的スタイル適用
- `apps/mobile/src/scenes/profile/Profile.js` - 設定UI追加

---

## 将来のタスク候補（優先度低）

すべてのコアフェーズは完了しています。以下は将来の機能追加候補です：

- [ ] リアルタイム更新機能（Supabase Realtime）
- [ ] オフライン対応（AsyncStorageキャッシュ）
- [ ] 多言語対応の拡充
- [ ] パフォーマンス最適化

---

## 実装済み：アプリ内記事リーダー ✅

### 概要
「Visit Original」で外部ブラウザを開く代わりに、アプリ内で記事を閲覧できる機能。

### 技術アプローチ
Pocket、Instapaper、Safari Reader Modeと同じ手法：

```
元のHTML → Readability で記事本文を抽出 → クリーンなHTML → react-native-render-html
```

### サーバーサイド実装（Cloudflare Pages Function）

```javascript
// functions/api/article-content.ts
import { parseHTML } from 'linkedom';  // jsdomはCF Workersで動作しないためlinkedomを使用
import { Readability } from '@mozilla/readability';

export async function onRequestGet(context) {
  const url = new URL(context.request.url).searchParams.get('url');

  // HTMLを取得
  const response = await fetch(url);
  const html = await response.text();

  // linkedomでDOM生成、Readabilityで記事本文を抽出
  const { document } = parseHTML(html);
  const reader = new Readability(document);
  const article = reader.parse();

  return Response.json({
    title: article.title,
    content: article.content,      // クリーンなHTML
    textContent: article.textContent, // プレーンテキスト
    excerpt: article.excerpt,
    byline: article.byline,
    siteName: article.siteName,
  });
}
```

### モバイル側実装

```javascript
// react-native-render-html を使用
import RenderHtml from 'react-native-render-html';
import { useWindowDimensions } from 'react-native';

function ArticleReader({ articleContent }) {
  const { width } = useWindowDimensions();
  const { isDarkMode } = useTheme();
  const theme = getThemeColors(isDarkMode);

  const tagsStyles = {
    body: { color: theme.text, backgroundColor: theme.background },
    p: { fontSize: 16, lineHeight: 26, marginBottom: 12 },
    h1: { fontSize: 24, fontWeight: 'bold', color: theme.text },
    h2: { fontSize: 20, fontWeight: 'bold', color: theme.text },
    a: { color: colors.primary },
    img: { maxWidth: '100%', height: 'auto' },
    pre: { backgroundColor: theme.surface, padding: 12, borderRadius: 8 },
    code: { fontFamily: 'monospace', backgroundColor: theme.surface },
  };

  return (
    <ScrollView>
      <RenderHtml
        contentWidth={width - 32}
        source={{ html: articleContent }}
        tagsStyles={tagsStyles}
      />
    </ScrollView>
  );
}
```

### 使用パッケージ

**サーバーサイド (functions/):**
- `linkedom` - 軽量DOM実装（Cloudflare Workers対応）
- `@mozilla/readability` - 記事本文抽出

**モバイル (apps/mobile/):**
- `react-native-render-html` - HTMLレンダリング

### 成功率の見込み

| コンテンツタイプ | 成功率 | 備考 |
|-----------------|--------|------|
| ニュースサイト | 90%+ | Readabilityが最適化されている |
| ブログ | 85%+ | 標準的な記事構造 |
| 技術ドキュメント | 70-80% | コードブロックの対応が必要 |
| SPA/Web App | 低い | JS依存のためHTML取得自体が困難 |

### 実装済みUI

1. **ArticleDetail画面に「📖 Reader Mode」ボタン**
2. タップするとAPIから記事コンテンツ取得（ローディング表示）
3. 取得成功 → ArticleReaderコンポーネントでレンダリング
4. 取得失敗 → エラートースト表示、「Visit Original」にフォールバック
5. ヘッダーに「Exit Reader」ボタンで元の表示に戻る

### 技術的注意点

- `jsdom`はNode.js依存のためCloudflare Workersでは動作しない → `linkedom`を使用
- 相対URLはAPIで絶対URLに変換済み
- 画像のCORS問題は一部のサイトで発生する可能性あり

---

## 開発環境セットアップ

### 必要なもの
- Node.js 22.19.0+
- npm
- Cloudflare アカウント（wrangler CLI）
- Supabase プロジェクト

### ローカル起動手順

```bash
# 1. 依存関係インストール
npm install

# 2. Vite開発サーバー起動（別ターミナル）
cd apps/web && npm run dev

# 3. Wrangler Pages起動（APIサーバー）
cd apps/web && npx wrangler pages dev dist \
  --compatibility-date=2024-01-01 \
  --binding SUPABASE_URL=https://xxxxx.supabase.co \
  --binding SUPABASE_ANON_KEY=your-anon-key \
  --binding SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  --binding WORKER_URL=https://feedown-worker.votepurchase.workers.dev
```

### 環境変数

**フロントエンド** (`apps/web/.env`):
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=
```

**ローカル開発時の注意:**
- `VITE_API_BASE_URL=` が空の場合、APIリクエストは同じホスト（localhost:5173）に送られる
- Vite開発サーバーだけではAPIは動かない（Cloudflare Pages Functionsが必要）
- **簡単な方法**: `VITE_API_BASE_URL=https://feedown.pages.dev` を設定して本番APIを使用
- wranglerでローカルAPIを起動する場合は空のままでOK

**Cloudflare Pages** (Secrets):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WORKER_URL`

---

## アーキテクチャ

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│   Web App       │────▶│  Cloudflare Pages   │────▶│  RSS Feeds      │
│   (React/Vite)  │     │  Functions (API)    │     │  (External)     │
└─────────────────┘     └──────────┬──────────┘     └─────────────────┘
                                   │
┌─────────────────┐     ┌──────────▼──────────┐
│   Mobile App    │────▶│     Supabase        │
│   (Expo)        │     │  - PostgreSQL       │
└─────────────────┘     │  - Auth             │
                        └─────────────────────┘

┌─────────────────────────────────────────────┐
│  Cloudflare Worker (Proxy + KV Cache)       │
│  ※ 将来のブラウザ直接アクセス用に保持        │
│  ※ 現在のrefresh APIでは未使用              │
└─────────────────────────────────────────────┘
```

**RSS取得フロー:**
- `/api/refresh` → Pages Functionsから直接RSSフィードを取得
- Worker/KV経由しないためKV制限（Write 1,000回/日）を回避

---

## データベーススキーマ

### テーブル一覧
- `user_profiles` - ユーザー情報
- `feeds` - RSSフィード
- `articles` - 記事（7日TTL）
- `read_articles` - 既読記事
- `favorites` - お気に入り
- `recommended_feeds` - おすすめフィード（公開データ）

### RLS (Row Level Security)
全テーブルでRLS有効。ユーザーは自分のデータのみアクセス可能。
`recommended_feeds`は公開テーブル（誰でも読み取り可能）。

---

## Recommended Feeds 管理

おすすめフィードはDBで管理され、Pythonスクリプトで更新します。

### 更新手順

```bash
# 1. scripts/sync_recommended_feeds.py の RECOMMENDED_FEEDS リストを編集
# 2. 依存関係インストール（初回のみ）
pip install -r scripts/requirements.txt

# 3. スクリプト実行（.env.shared に SUPABASE_SERVICE_ROLE_KEY が必要）
python scripts/sync_recommended_feeds.py

# 4. Web版をデプロイ（キャッシュクリアのため）
npm run build --workspace=apps/web
npx wrangler pages deploy apps/web/dist --project-name=feedown
```

### フィード検証コマンド

```bash
# 追加前にフィードURLをテスト（パース可能か確認）
python scripts/sync_recommended_feeds.py --test "https://example.com/feed.xml"

# 全フィードの一括検証
python scripts/sync_recommended_feeds.py --check
```

### 関連ファイル
- `scripts/sync_recommended_feeds.py` - フィード一覧とDB同期スクリプト
- `functions/api/recommended-feeds.js` - APIエンドポイント（GET /api/recommended-feeds）

---

## 既知の制限事項

1. **Delete Account**: Supabase Auth recordが残る可能性あり（データは削除される）
2. **記事の有効期限**: 7日後に自動削除される設計
3. **リアルタイム更新**: 未実装（オプション機能）
4. **テストアカウント制限**: フィード3個、お気に入り10個まで

---

## トラブルシューティング

### 記事が表示されない
1. ブラウザのキャッシュをクリア（Ctrl+Shift+R）
2. DevToolsのNetworkタブで「Disable cache」有効化
3. wranglerログで`[Refresh]`と`[Articles]`を確認

### API 500エラー
1. wranglerターミナルでエラーログ確認
2. Supabase Dashboardでログ確認
3. 環境変数が正しく設定されているか確認

### API 405エラー
1. **ルートディレクトリからデプロイしているか確認**
2. `apps/web`からデプロイするとfunctionsが含まれない

### 認証エラー
1. Supabase DashboardでAuthenticationログ確認
2. JWTトークンの有効期限確認
3. RLSポリシーが正しく設定されているか確認

### モバイルアプリが起動しない
1. `npx expo start --clear` でキャッシュクリア
2. `node_modules`削除後に`npm install`
3. babel.config.jsのエイリアス設定確認

### EAS Buildエラー
1. `npx expo install --fix` で依存関係を自動修正
2. `eas.json`のNodeバージョン確認（22.19.0）
3. ビルドログで具体的なエラーを確認

---

## 連絡先・リソース

- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **Supabase Dashboard**: https://app.supabase.com
- **GitHub Issues**: プロジェクトのIssueトラッカー
