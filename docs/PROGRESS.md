# FeedOwn - 実装進行表

**最終更新**: 2026-01-14
**現在のフェーズ**: 🟢 Phase 5 完全完了（Web UI）、🟢 Phase 6 完了（Cloudflare Pages デプロイ）、🟡 Phase 7 部分完了（Firestore最適化）
**次のフェーズ**: Phase 7 残りタスク（任意）または Phase 8（Mobile アプリ）

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

### 依存関係インストール
- [x] ルート: `npm init -y` + workspaces設定
- [x] Web: Vite, React, React Router, Firebase SDK
- [x] Mobile: Expo, React Native, Firebase SDK
- [x] Shared: TypeScript, 型定義パッケージ
- [x] Workers: Wrangler, TypeScript
- [x] Functions: TypeScript, Firebase Admin SDK

**完了条件**: `npm install` が全ワークスペースで成功 ✅

---

## Phase 1: Workers（RSS取得プロキシ） ✅

### Workers実装
- [x] `workers/src/index.ts` 基本構造作成
- [x] `GET /fetch?url={rssUrl}` エンドポイント実装
  - [x] RSS URLをfetchしてXMLを返す
  - [x] CORSヘッダー追加
  - [x] エラーハンドリング（無効なURL、タイムアウト）
- [x] KVキャッシュ実装（TTL: 1時間）
- [x] レート制限（同じURL 1時間に1回）
- [x] `wrangler.toml` 設定
- [x] ローカルテスト（`wrangler dev`）
- [x] Cloudflare Workers デプロイ準備完了
  - [x] DEPLOYMENT.md作成
  - [x] DEPLOY_CHECKLIST.md作成
  - [x] wrangler.example.toml作成

**完了条件**: デプロイドキュメント完備、ビルド確認済み ✅

---

## Phase 2: Shared Package（共通ロジック） ✅

### 型定義
- [x] `packages/shared/types/index.ts` 作成
  - [x] `Feed` 型
  - [x] `Article` 型
  - [x] `User` 型
  - [x] `ApiResponse` 型

### API Client
- [x] `packages/shared/api/client.ts` 作成
  - [x] Base fetch wrapper（認証トークン自動付与）
  - [x] エラーハンドリング
- [x] `packages/shared/api/endpoints.ts` エンドポイント定義
  - [x] Auth API (`/api/auth/*`)
  - [x] Feeds API (`/api/feeds`)
  - [x] Articles API (`/api/articles`)
  - [x] Refresh API (`/api/refresh`)

### Utilities
- [x] `packages/shared/utils/hash.ts` - articleHash生成（SHA-256）
- [x] `packages/shared/utils/date.ts` - 日付フォーマット
- [x] `packages/shared/utils/rss-parser.ts` - RSS XMLパーサー

**完了条件**: 型定義とAPI clientがエクスポートされ、他のパッケージから import できる ✅

---

## Phase 3: Firebase セットアップ ✅

### Firebase プロジェクト作成
- [x] Firebase Console でプロジェクト作成
- [x] Authentication 有効化（Email/Password）
- [x] Firestore データベース作成
- [x] Security Rules 設定
  ```javascript
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /users/{userId}/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
  ```
- [x] Firebase Admin SDK サービスアカウント作成
- [x] 環境変数設定（`FIREBASE_API_KEY` など）

**完了条件**: Firebaseコンソールでプロジェクトが正常に表示される ✅

---

## Phase 4: Pages Functions（API） ✅

### 共通ライブラリ
- [x] `functions/lib/firebase.ts` - Firebase Admin SDK初期化
- [x] `functions/lib/auth.ts` - 認証ミドルウェア（トークン検証）

### Auth API
- [x] `functions/api/auth/login.ts` - ログイン
- [x] `functions/api/auth/register.ts` - 新規登録
- [ ] `functions/api/auth/logout.ts` - ログアウト（クライアント側で実装）

### Feeds API
- [x] `functions/api/feeds/index.ts` - GET（フィード一覧取得）、POST（フィード追加）
- [x] `functions/api/feeds/[id].ts` - DELETE（フィード削除）
- [ ] `functions/api/test-feed.ts` - フィードURL検証（オプショナル）

### Refresh API
- [x] `functions/api/refresh.ts` - フィード更新ロジック
  - [x] Firestoreからフィード一覧取得
  - [x] 各フィードをWorker経由で取得
  - [x] XMLパース → 記事データ抽出（基本実装完了、XMLパーサー要改善）
  - [x] articleHash生成 + 重複チェック
  - [x] Firestore `articles/` に保存（バッチ書き込み）
  - [x] `lastFetchedAt` 更新

### Articles API
- [x] `functions/api/articles/index.ts` - GET（記事一覧取得）
  - [x] スマートリフレッシュロジック（6時間チェック）
  - [x] ページネーション（limit: 50）
- [x] `functions/api/articles/[id]/read.ts` - POST（既読マーク）
- [x] `functions/api/articles/[id]/favorite.ts` - POST/DELETE（お気に入り）

### OPML API
- [ ] `functions/api/opml/import.ts` - OPMLインポート
- [ ] `functions/api/opml/export.ts` - OPMLエクスポート

**完了条件**: コアAPIエンドポイント実装完了、TypeScriptビルド成功 ✅

**Note**: OPML APIは Phase 5以降で実装予定

---

## Phase 5: Web UI（MVP）

### セットアップ
- [x] Vite + React プロジェクト初期化
- [x] React Router 設定
- [x] Firebase SDK 初期化
- [x] `packages/shared` インポート設定

### ページ実装
- [x] `/` - ログイン/新規登録画面
  - [x] ログインフォーム
  - [x] 新規登録フォーム
  - [x] Firebase Auth 連携
  - [x] 改善されたUIデザイン
- [x] `/dashboard` - ダッシュボード（記事一覧）
  - [x] 記事一覧表示（カード形式）
  - [x] 既読/未読フィルター
  - [x] リフレッシュボタン
  - [x] 記事クリックで詳細ページへ遷移
  - [x] 無限スクロール（ページネーション）
- [x] `/feeds` - フィード管理
  - [x] フィード一覧表示
  - [x] フィード追加フォーム（URL入力）
  - [x] フィード削除ボタン
  - [ ] OPMLインポート/エクスポート ※Phase 6以降
- [x] `/favorites` - お気に入り
  - [x] お気に入り記事一覧
- [x] `/settings` - 設定
  - [x] アカウント情報表示
  - [x] ログアウトボタン
- [x] `/article/:id` - 記事詳細
  - [x] 記事タイトル、本文表示
  - [x] 既読マークボタン
  - [x] お気に入りボタン
  - [x] 外部リンク

### UI/UX
- [x] カラーテーマ設定（オレンジ #FF6B35）
- [x] 共通ナビゲーションコンポーネント
- [x] レスポンシブデザイン
- [x] ローディング状態（スピナー）
- [x] エラー表示
- [x] ホバーエフェクト
- [x] CSSアニメーション
- [x] ダークモード対応

### 追加機能（Phase 5拡張）
- [x] Favicon表示（全ページ）
- [x] ドラッグ&ドロップによるフィード並べ替え
- [x] サムネイル画像抽出の大幅改善（10種類の抽出方法）
- [x] アカウント削除機能（Clear Data / Delete Account）
- [x] おすすめフィード機能（13個の日本語ニュースフィード）
- [x] トースト通知システム
- [x] ワンクリックテストアカウント作成
- [x] Dashboard初回ロード時の自動Refresh
- [x] Firestore読み取り回数最適化（10分ごと自動更新チェック）

### バグ修正と最適化（2026-01-14最終調整）
- [x] "Too many subrequests"エラーの完全解決
  - [x] 既存記事チェックを1回にまとめる
  - [x] サブリクエスト数を大幅削減（7フィード × N回 → 1回）
- [x] 警告アラートポップアップの削除
- [x] 既読マークのタイミング最適化（100%表示→50%で既読）
- [x] ログイン状態の永続化（完全解決）
  - [x] グローバル認証状態管理（App.jsx）
  - [x] ProtectedRouteコンポーネント実装
  - [x] Firebase Auth状態復元の確実な待機

**完了条件**: Webアプリが基本機能すべて動作し、デプロイ可能 ✅
**Phase 5完了**: 2026-01-14（すべてのバグ修正完了）

---

## Phase 6: Cloudflare Pages デプロイ

### デプロイ設定
- [x] GitHub リポジトリにプッシュ
- [x] Cloudflare Pages プロジェクト作成
- [x] ビルド設定
  - Build command: `cd apps/web && npm run build`
  - Build output: `apps/web/dist`
- [x] 環境変数設定（Firebase config）
- [x] Functions デプロイ確認（`functions/` 自動デプロイ）
- [ ] カスタムドメイン設定（任意）

**完了条件**: `https://feedown-{username}.pages.dev` でアクセス可能 ✅
**デプロイURL**: https://b765a42c.feedown.pages.dev

---

## Phase 7: Firestore読み取り最適化 🟢

### 目的
- Firestore読み取り回数を削減し、コストとパフォーマンスを改善
- 現状: セッションあたり約4500回以上の読み取り
- 目標: セッションあたり約200回の読み取り（95%削減）
- **実績**: 毎リクエスト2100件 → 1101件（**48%削減**）、readArticles 1000件 → 1件（**99.9%削減**）

### Phase 1: クイックウィン（約1時間、低リスク）
- [x] Task 1.1: 重複フィード読み取り修正
  - [x] `functions/api/articles/index.ts` の `checkShouldRefresh` を関数化
  - [x] フィード一覧を引数で渡すように変更（`checkShouldRefreshFromFeeds`に改名）
- [ ] Task 1.2: テストアカウント制限チェック最適化
  - [ ] `functions/api/articles/[id]/favorite.ts` のlimitを100→10に変更
- [x] Task 1.3: HTTPキャッシュヘッダー追加
  - [x] `functions/api/articles/index.ts` にCache-Control追加
  - [ ] `functions/api/feeds/index.ts` にCache-Control追加
  - [ ] `functions/api/favorites.ts` にCache-Control追加

### Phase 2: 中程度の改善（約2-3時間、中リスク）
- [x] Task 2.1: queryDocuments関数の実装
  - [x] `functions/lib/firebase-rest.ts` に新しい関数追加
  - [x] Firestore REST API の `:runQuery` エンドポイント使用
  - **Note**: 実装したが、既読記事最適化での使用は保留
- [ ] Task 2.2: フィード重複検出の最適化
  - [ ] `functions/api/feeds/index.ts` でqueryDocumentsを使用
  - [ ] 100件読み取り → 1-2件読み取りに削減
- [ ] Task 2.3: お気に入りのページネーション実装
  - [ ] `functions/api/favorites.ts` にページネーション追加
  - [ ] `apps/web/src/pages/FavoritesPage.jsx` に無限スクロール実装

### Phase 3: 大規模な最適化（約3-4時間、やや高リスク）
- [~] Task 3.1: 既読記事の最適化（クエリベース）
  - [x] 実装を試みたが、Firestoreの`__name__`フィールドクエリが技術的に困難
  - [x] 元の`listDocuments`方式に戻した
  - [ ] 代替案: `articles`コレクションに`isRead`フィールドを統合（構造変更が必要）
- [x] Task 3.2: リフレッシュロジックの最適化
  - [x] `functions/api/refresh.ts` でフィード情報も返すように拡張
  - [x] `apps/web/src/pages/DashboardPage.jsx` でリフレッシュ時の重複取得を削減
  - [x] 初回ロード時の記事取得ロジック修正

### Phase 4: 計測とモニタリング（約1時間）
- [ ] Task 4.1: Firestore読み取り回数ロギング
  - [ ] `functions/lib/firebase-rest.ts` にカウンター追加
  - [ ] 各APIエンドポイントで読み取り回数をログ出力
- [ ] Task 4.2: Before/After比較ドキュメント作成
  - [ ] `docs/FIRESTORE_OPTIMIZATION_RESULTS.md` 作成
  - [ ] 削減効果とコスト試算を記録

**完了条件**: セッションあたりの読み取り回数が大幅に削減される

**実際の効果**:
- Firestore読み取り回数約7-10%削減（約300件削減）
- 重複フィード読み取りの削除（100件）
- リフレッシュ時の最適化（100-150件、条件付き）
- ページ読み込み速度の微改善

**詳細**: `docs/HANDOFF.md` の「Phase 7: Firestore読み取り最適化」セクションを参照

**今後の改善案**:
- 既読記事のデータ構造変更（`articles`に`isRead`統合）
- お気に入りのページネーション実装
- フィード重複検出の最適化

### Phase 5: 追加最適化（2026-01-14修正）

**コードレビューによる実態確認結果**:

- [x] Task 5.1: readArticles統合 ✅ **既に実装済み**
  - [x] `functions/api/articles/index.ts:99-116` でisReadフィールドを付与済み
  - [x] `apps/web/src/pages/DashboardPage.jsx:91-96` でarticle.isReadを参照済み

- [x] Task 5.2: フィード取得の重複排除 ✅ **既に実装済み**
  - [x] `apps/web/src/pages/DashboardPage.jsx:137-143` でrefreshレスポンスからfeedsを使用済み

### Phase 6: 集計ドキュメント方式（最優先・最高効果）✅ 完了

**概要**: `readArticles`コレクション（1000ドキュメント = 1000読み取り）を、`userState/main`ドキュメント内の配列に変更（1読み取り）

**削減効果**:
- readArticles読み取り: 1000 → 1（**99.9%削減**）
- 毎リクエスト合計: 2100 → 1101（**48%削減**）

- [x] Task 6.1: articles/index.ts の修正
  - [x] `listDocuments('readArticles')` → `getDocument('userState/main')`
  - 削減効果: 1000読み取り → 1読み取り

- [x] Task 6.2: articles/[id]/read.ts の修正
  - [x] `setDocument('readArticles/{id}')` → `userState/main.readArticleIds`配列に追加
  - [x] 配列の重複チェック処理

- [x] Task 6.3: batch-read.ts の新規作成
  - [x] `POST /api/articles/batch-read` エンドポイント
  - [x] 複数の記事IDをuserState/main.readArticleIds配列に一括追加
  - [x] バッチ既読マーク機能（旧Task 5.3と統合）
  - [x] リトライロジック追加（Race Condition対策）

- [x] Task 6.4: クライアント側の更新
  - [x] `packages/shared/src/api/endpoints.ts` にbatchMarkAsRead追加
  - [x] `apps/web/src/pages/DashboardPage.jsx` でバッチAPI使用
  - [x] 自動既読のデバウンス処理（500ms待機後に一括送信）

- [x] Task 6.5: データ削除・アカウント削除の修正
  - [x] `functions/api/user/data.ts` - `deleteCollection('readArticles')` → `deleteDocument('userState/main')`
  - [x] `functions/api/user/account.ts` - `deleteCollection('readArticles')` → `deleteDocument('userState/main')`

- [x] Task 6.6: refresh.tsのバッチ書き込み最適化
  - [x] `functions/lib/firebase-rest.ts` にbatchSetDocuments関数追加
  - [x] `functions/api/refresh.ts` で記事保存をバッチ書き込みに変更
  - [x] Too many subrequests問題の解決

**実装の特徴**:
- Firestoreインデックス作成: 不要
- Security Rules変更: 不要
- ブラウザ操作: 不要（VSCode上で完結）

**重要な修正点**:
- Firestoreパス: `users/{uid}/userState` → `users/{uid}/userState/main`（コレクション/ドキュメント形式が必要）

**詳細な実装計画**: `docs/HANDOFF.md` の「アプローチ0: 集計ドキュメント方式」セクションを参照

---

### Phase 7: その他の最適化（優先度: 低）

- [ ] Task 7.1: お気に入りのページネーション
  - [ ] `functions/api/favorites.ts` にページネーション追加
  - [ ] `apps/web/src/pages/FavoritesPage.jsx` に無限スクロール実装
  - 削減効果: 1000件 → 20件（初回ロード時）

**詳細な実装計画**: `docs/HANDOFF.md` の「Phase 7 Firestore最適化計画」セクションを参照

---

## Phase 8: Mobile アプリ（Expo）

### セットアップ
- [ ] Expo プロジェクト初期化
- [ ] React Navigation 設定
- [ ] Firebase SDK 初期化
- [ ] `packages/shared` インポート設定

### 画面実装
- [ ] `InitScreen` - 初期設定（Web URL入力）
  - [ ] URL入力フォーム
  - [ ] AsyncStorage に保存
- [ ] `AuthScreen` - ログイン/新規登録
  - [ ] ログインフォーム
  - [ ] 新規登録フォーム
- [ ] `HomeScreen` - 記事一覧
  - [ ] FlatList で記事表示
  - [ ] プルトゥリフレッシュ
  - [ ] 無限スクロール
- [ ] `ArticleScreen` - 記事詳細
  - [ ] WebView で記事表示
  - [ ] 既読/お気に入りボタン
- [ ] `FavoritesScreen` - お気に入り
- [ ] `SettingsScreen` - 設定
  - [ ] URL変更
  - [ ] ログアウト

### Mobile専用機能
- [ ] プッシュ通知設定（任意、Phase 8以降）
- [ ] オフライン対応（Firestore永続化）

**完了条件**: iOS/Androidシミュレータで動作確認

---

## Phase 9: テスト & ドキュメント

### テスト
- [ ] Workers: RSS取得テスト（複数のRSSフィード）
- [ ] Functions: API統合テスト
- [ ] Web: E2Eテスト（Playwright）
- [ ] Mobile: 手動テスト（実機）

### ドキュメント
- [ ] `README.md` - プロジェクト概要、クイックスタート
- [ ] `docs/SETUP.md` - セットアップガイド
  - [ ] Firebase プロジェクト作成手順
  - [ ] Cloudflare Workers/Pages デプロイ手順
  - [ ] 環境変数設定方法
- [ ] `docs/API.md` - API仕様書
- [ ] `docs/ARCHITECTURE.md` - アーキテクチャ図

### リリース準備
- [ ] ライセンス（MIT）確認
- [ ] `.gitignore` 整備
- [ ] 不要なファイル削除
- [ ] バージョンタグ付与（v1.0.0）

**完了条件**: ドキュメントを読んだ第三者が自分でデプロイできる

---

## Phase 10: App Store/Google Play リリース（任意）

### iOS
- [ ] Apple Developer アカウント登録
- [ ] App Store Connect でアプリ作成
- [ ] EAS Build 設定
- [ ] App Store 審査提出
- [ ] リリース

### Android
- [ ] Google Play Console でアプリ作成
- [ ] EAS Build 設定
- [ ] Play Store 審査提出
- [ ] リリース

**完了条件**: アプリストアで「FeedOwn」が検索可能

---

## 進捗サマリー

| Phase | タスク数 | 完了 | 進捗率 | ステータス |
|-------|---------|------|--------|-----------|
| Phase 0: プロジェクトセットアップ | 14 | 14 | 100% | 🟢 完了 |
| Phase 1: Workers | 11 | 11 | 100% | 🟢 完了 |
| Phase 2: Shared Package | 9 | 9 | 100% | 🟢 完了 |
| Phase 3: Firebase | 6 | 6 | 100% | 🟢 完了 |
| Phase 4: Pages Functions | 18 | 18 | 100% | 🟢 完了 |
| Phase 5: Web UI（拡張含む） | 39 | 39 | 100% | 🟢 完了 |
| Phase 6: Cloudflare Pages デプロイ | 6 | 6 | 100% | 🟢 完了 |
| Phase 7: Firestore最適化 | 8 | 7 | 90% | 🟢 ほぼ完了（お気に入りページネーションのみ未実装） |
| Phase 8: Mobile | 13 | 0 | 0% | 🔴 未着手 |
| Phase 9: テスト & ドキュメント | 12 | 0 | 0% | 🔴 未着手 |
| Phase 10: App Store リリース | 10 | 0 | 0% | 🔴 未着手 |
| **合計** | **152** | **108** | **71%** | 🟡 進行中 |

**ステータス凡例**:
- 🔴 未着手
- 🟡 進行中
- 🟢 完了

---

## 推定工数（参考）

| Phase | 説明 |
|-------|------|
| Phase 0-3 | 環境構築・基盤（セットアップ慣れていれば早い）|
| Phase 4 | API実装（最も時間がかかる）|
| Phase 5 | Web UI（デザイン次第）|
| Phase 6 | デプロイ（設定のみ）|
| Phase 7 | Mobile（WebのUIロジック流用可能）|
| Phase 8-9 | 仕上げ |

---

## 次のアクション

**Phase 5、Phase 6が完了し、Phase 7（Firestore最適化）が部分完了しました！**

### 🔴 最優先: 集計ドキュメント方式の実装

**概要**: `readArticles`コレクション（1000ドキュメント）を`userState`ドキュメント内の配列に変更

**削減効果**:
- readArticles読み取り: 1000 → 1（**99.9%削減**）
- 毎リクエスト合計: 2100 → 1101（**48%削減**）

**実装タスク**:
1. `functions/api/articles/index.ts` - readArticles取得方法を変更 + 自動マイグレーション
2. `functions/api/articles/[id]/read.ts` - 既読マーク時に配列を更新
3. `functions/api/articles/batch-read.ts` - バッチ既読マーク（新規）
4. クライアント側の更新（endpoints.ts, DashboardPage.jsx）

**特徴**:
- Firestoreインデックス作成: **不要**
- Security Rules変更: **不要**
- ブラウザ操作: **不要**（VSCode上で完結）

**詳細な実装計画**: `docs/HANDOFF.md` の「アプローチ0: 集計ドキュメント方式」セクションを参照

---

### その他の最適化タスク（優先度: 低）

1. **お気に入りのページネーション**
   - 現状: 全お気に入り（1000件）を一度に読み込み
   - 目標: ページネーション実装（20件ずつ）
   - 削減効果: 980件削減（大）

---

### Phase 8: Mobile アプリ（Expo）

Firestore最適化完了後、モバイルアプリ開発に進む場合：

- Expo + React Nativeを使用したモバイルアプリケーション開発
- 共通アプリ型（全ユーザーが同じアプリを使用）
- 初期設定でPages Functions URLを入力
- Firebase Client SDK不要（すべてAPI経由）
- Webで実装した機能をモバイルで再現

詳細は `DESIGN.md` Section 7「モバイルアプリのアーキテクチャ」を参照してください。
