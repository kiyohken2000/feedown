# FeedOwn - 実装進行表

**最終更新**: 2026-01-16
**現在のフェーズ**: 🟡 Phase 9 進行中（Mobile アプリ）
**次のフェーズ**: Phase 10（テスト & ドキュメント）

---

## Phase 0: プロジェクトセットアップ ✅

### 環境構築
- [x] ルートディレクトリのモノレポ設定 (`package.json` workspaces)
- [x] `apps/web` ディレクトリ作成（Vite + React）
- [x] `apps/mobile` ディレクトリ作成（Expo）
- [x] `packages/shared` ディレクトリ作成（共通ロジック）
- [x] `workers` ディレクトリ作成（Cloudflare Workers）
- [x] `functions` ディレクトリ作成（Cloudflare Pages Functions）
- [x] `.env.example` と `.env.shared` 作成
- [x] `scripts/sync-envs.sh` スクリプト作成

**完了条件**: `npm install` が全ワークスペースで成功 ✅

---

## Phase 1: Workers（RSS取得プロキシ） ✅

- [x] `workers/src/index.ts` 基本構造作成
- [x] `GET /fetch?url={rssUrl}` エンドポイント実装
- [x] KVキャッシュ実装（TTL: 1時間）
- [x] レート制限（同じURL 1時間に1回）
- [x] ローカルテスト・デプロイ準備完了

**完了条件**: デプロイドキュメント完備、ビルド確認済み ✅

---

## Phase 2: Shared Package（共通ロジック） ✅

- [x] 型定義（`Feed`, `Article`, `User`, `ApiResponse`）
- [x] API Client（認証トークン自動付与）
- [x] ユーティリティ（ハッシュ生成、日付フォーマット、RSSパーサー）

**完了条件**: 他のパッケージから import できる ✅

---

## Phase 3: Firebase セットアップ ✅ (→ Phase 8で Supabase に移行)

- [x] Firebase Console でプロジェクト作成
- [x] Authentication 有効化（Email/Password）
- [x] Firestore データベース作成
- [x] Security Rules 設定

**Note**: Phase 8でSupabaseに移行予定

---

## Phase 4: Pages Functions（API） ✅ (→ Phase 8で Supabase に移行)

- [x] 認証API（login, register）
- [x] フィードAPI（CRUD）
- [x] 記事API（一覧、既読、お気に入り）
- [x] リフレッシュAPI（RSS取得・保存）
- [x] ユーザーAPI（アカウント削除、データクリア）

**完了条件**: コアAPIエンドポイント実装完了 ✅

---

## Phase 5: Web UI（MVP） ✅

- [x] ログイン/新規登録画面
- [x] ダッシュボード（記事一覧、無限スクロール）
- [x] フィード管理（追加、削除、ドラッグ&ドロップ並べ替え）
- [x] お気に入り
- [x] 設定（ログアウト、アカウント削除）
- [x] 記事詳細ページ
- [x] ダークモード対応
- [x] トースト通知システム

**完了条件**: Webアプリが基本機能すべて動作 ✅

---

## Phase 6: Cloudflare Pages デプロイ ✅

- [x] GitHub リポジトリにプッシュ
- [x] Cloudflare Pages プロジェクト作成
- [x] ビルド設定・環境変数設定
- [x] Functions デプロイ確認

**デプロイURL**: https://feedown.pages.dev ✅

---

## Phase 7: Firestore読み取り最適化 ✅

- [x] 集計ドキュメント方式実装（readArticles: 1000件→1件で99.9%削減）
- [x] バッチ既読マーク実装
- [x] リフレッシュロジック最適化

**実績**: 毎リクエスト2100件 → 1101件（48%削減）✅

---

## Phase 8: Supabase 移行 ✅ 完了

### 目的
- Firestore無料枠の制限（読み取り5万件/日、書き込み2万件/日）を解消
- PostgreSQLの柔軟なクエリを活用

### Step 1: Supabase準備 ✅
- [x] データベーススキーマ作成（SQL実行）
- [x] RLSポリシー設定
- [x] 環境変数設定

### Step 2: バックエンド移行 ✅
- [x] `functions/lib/supabase.ts` 新規作成
- [x] `functions/lib/auth.ts` 書き換え（Supabase JWT検証）
- [x] `functions/api/feeds/index.ts` 移行
- [x] `functions/api/feeds/[id].ts` 移行
- [x] `functions/api/articles/index.ts` 移行（キャッシュ無効化対応）
- [x] `functions/api/articles/batch-read.ts` 移行
- [x] `functions/api/articles/[id]/read.ts` 移行
- [x] `functions/api/articles/[id]/favorite.ts` 移行
- [x] `functions/api/favorites.ts` 移行
- [x] `functions/api/refresh.ts` 移行
- [x] `functions/api/user/account.ts` 移行
- [x] `functions/api/user/data.ts` 移行
- [x] `functions/lib/firebase-rest.ts` 削除

### Step 3: フロントエンド移行 ✅
- [x] `apps/web/src/lib/supabase.js` 新規作成
- [x] `apps/web/src/App.jsx` 認証状態管理
- [x] `apps/web/src/pages/LoginPage.jsx` Supabase Auth対応
- [x] `apps/web/src/pages/SettingsPage.jsx` ログアウト対応
- [x] `apps/web/src/pages/DashboardPage.jsx` stale closure修正
- [x] 各ページのAPIトークン取得更新

### Step 4: リアルタイム実装 🔴 未実装（オプション）
- [ ] `apps/web/src/hooks/useRealtimeArticles.js` 作成
- [ ] DashboardPageにRealtime統合

### Step 5: ドキュメント更新 ✅
- [x] `docs/DESIGN.md` 更新
- [x] `docs/PROGRESS.md` 更新
- [x] `HANDOFF.md` 作成

### 修正した問題
1. **キャッシュ問題**: `Cache-Control: no-cache` に変更
2. **stale closure**: `handleRefreshRef` パターンで解決
3. **Delete Account**: Auth削除をオプショナルに

**完了条件**: Supabaseで全機能が動作 ✅

---

## Phase 9: Mobile アプリ（Expo） ✅ 完了

### Step 1: ボイラープレート起動・ビルド ✅
- [x] モノレポ構成でExpo Go起動
- [x] カスタムエントリポイント設定（`App.js` + `registerRootComponent`）
- [x] babel.config.js module-resolverエイリアス設定
- [x] EAS Build（iOS preview）成功
- [x] 依存関係バージョン調整（expo, expo-updates, react-native-worklets）

### Step 2: Supabase認証実装 ✅
- [x] SignIn画面をSupabase Auth対応に変更
- [x] SignUp画面をSupabase Auth対応に変更
- [x] AsyncStorageでセッション永続化
- [x] 自動ログイン機能

### Step 3: API連携 ✅
- [x] APIクライアント作成（`src/utils/api.js`）
- [x] FeedsContext状態管理（`src/contexts/FeedsContext.js`）
- [x] フィード一覧取得
- [x] 記事一覧取得
- [x] リフレッシュ機能

### Step 4: 画面実装 ✅
- [x] Dashboard画面（記事一覧）- `scenes/home/Home.js`
- [x] フィード管理画面 - `scenes/read/Read.js`
- [x] 設定画面（サインアウト、アカウント削除）- `scenes/profile/Profile.js`
- [x] ボトムタブ更新（Articles / Feeds / Settings）
- [x] 記事詳細画面 - `scenes/article/ArticleDetail.js`
  - 記事タップ時に詳細画面に遷移
  - 詳細画面を開いたときに既読マーク
  - お気に入り追加/削除ボタン
  - Visit Originalボタン（外部ブラウザで開く）
- [x] お気に入り画面 - `scenes/favorites/Favorites.js`
  - お気に入り記事一覧表示
  - 記事タップで詳細画面に遷移
  - 削除機能付き

### Step 5: UX改善 ✅
- [x] プルトゥリフレッシュ
- [x] 無限スクロール
- [x] All/Unread/Readフィルター
- [x] Mark All Readボタン
- [x] おすすめフィード（2列グリッド表示）
- [ ] オフライン対応（キャッシュ）（オプション）

### Step 6: Recommended Feeds DB移行 ✅
- [x] `recommended_feeds`テーブル作成（Supabase）
- [x] Pythonスクリプト作成（`scripts/sync_recommended_feeds.py`）
- [x] APIエンドポイント作成（`GET /api/recommended-feeds`）
- [x] Web版をDBから取得するように修正
- [x] Mobile版をDBから取得するように修正

### Step 7: バグ修正 ✅
- [x] Clear All Data後の表示問題を修正（useFocusEffect / visibilitychange）

### Step 8: ダークモード実装 ✅
- [x] ThemeContext作成（AsyncStorage永続化）
- [x] テーマカラー定義（lightTheme / darkTheme）
- [x] 全画面のダークモード対応（Home, Favorites, Read, Profile, ArticleDetail）
- [x] コンポーネントのダークモード対応（ScreenTemplate, TextInputBox, Toast）
- [x] ボトムタブナビゲーターのダークモード対応
- [x] Settings画面にダークモードトグル追加

### Step 9: サーバーURL入力機能 ✅
- [x] supabase.jsを動的URL対応に変更（AsyncStorageでサーバーURL保存）
- [x] UserContextをAPI経由認証に変更（Supabase SDK直接使用から移行）
- [x] SignIn画面にサーバーURL入力欄追加
- [x] SignUp画面にサーバーURL入力欄追加
- [x] SignIn/SignUp画面のヘッダーデザインを他の画面に統一
- [x] ナビゲーションヘッダー非表示（画面内ヘッダーのみ表示）
- [x] ロゴ画像（logo-lg.png）をSignIn/SignUp画面に表示

### Step 10: Quick Create Test Account & UI改善 ✅
- [x] SignUp画面に「Quick Create Test Account」ボタン追加
- [x] テストアカウント制限の注意書き（Settings画面）
- [x] Settings画面AboutセクションにアプリアイコンとWebサイトリンク追加
- [x] Articles画面の空状態メッセージにプルトゥリフレッシュ説明追加
- [x] Feeds画面のrecommended feeds取得エラー修正

### Step 11: アプリ内記事リーダー機能 ✅
- [x] 記事コンテンツ抽出API作成（linkedom + @mozilla/readability）
- [x] react-native-render-htmlインストール
- [x] ArticleReaderコンポーネント作成
- [x] ArticleDetail画面にReader Modeボタン追加
- [x] ダークモード対応

**完了条件**: iOS/Androidで全機能が動作 ✅

---

## Phase 10: テスト & ドキュメント 🔴 未着手

- [ ] Workers: RSS取得テスト
- [ ] Functions: API統合テスト
- [ ] Web: E2Eテスト（Playwright）
- [ ] `docs/SETUP.md` - セットアップガイド
- [ ] `docs/API.md` - API仕様書

**完了条件**: ドキュメントを読んだ第三者が自分でデプロイできる

---

## Phase 11: App Store/Google Play リリース（任意） 🔴 未着手

- [ ] Apple Developer アカウント登録
- [ ] Google Play Console でアプリ作成
- [ ] EAS Build 設定
- [ ] 審査提出・リリース

---

## 進捗サマリー

| Phase | タスク数 | 完了 | 進捗率 | ステータス |
|-------|---------|------|--------|-----------|
| Phase 0: プロジェクトセットアップ | 8 | 8 | 100% | 🟢 完了 |
| Phase 1: Workers | 5 | 5 | 100% | 🟢 完了 |
| Phase 2: Shared Package | 3 | 3 | 100% | 🟢 完了 |
| Phase 3: Firebase | 4 | 4 | 100% | 🟢 完了 |
| Phase 4: Pages Functions | 5 | 5 | 100% | 🟢 完了 |
| Phase 5: Web UI | 10 | 10 | 100% | 🟢 完了 |
| Phase 6: Cloudflare Pages デプロイ | 4 | 4 | 100% | 🟢 完了 |
| Phase 7: Firestore最適化 | 3 | 3 | 100% | 🟢 完了 |
| Phase 8: Supabase移行 | 20 | 18 | 90% | 🟢 完了 |
| Phase 9: Mobile | 30 | 30 | 100% | 🟢 完了 |
| Phase 10: テスト & ドキュメント | 5 | 0 | 0% | 🔴 未着手 |
| Phase 11: App Store リリース | 4 | 0 | 0% | 🔴 未着手 |

---

## 技術スタック（移行後）

| レイヤー | 技術 |
|---------|------|
| Frontend (Web) | Vite + React + JavaScript |
| Frontend (Mobile) | Expo + React Native |
| Backend API | Cloudflare Pages Functions |
| RSS Proxy | Cloudflare Workers + KV |
| Database | **Supabase PostgreSQL** |
| Auth | **Supabase Auth** |
| Realtime | **Supabase Realtime** |

---

## 次のアクション

1. **モバイルアプリ: Expo Goでテスト**（動作確認）
2. **モバイルアプリ: EAS Build**（iOS/Android preview ビルド）
3. **お気に入り画面実装**（オプション）
4. **リアルタイム更新機能**（オプション: Supabase Realtime）
5. **オフライン対応**（オプション: AsyncStorageキャッシュ）
