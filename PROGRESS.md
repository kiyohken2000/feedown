# FeedOwn - 実装進行表

**最終更新**: 2026-01-14
**現在のフェーズ**: 🟢 Phase 5 完全完了（Web UI）、🟢 Phase 6 完了（Cloudflare Pages デプロイ）
**次のフェーズ**: Phase 7（Mobile アプリ）へ移行可能

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
**デプロイURL**: https://8522aa45.feedown.pages.dev

---

## Phase 7: Mobile アプリ（Expo）

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

## Phase 8: テスト & ドキュメント

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

## Phase 9: App Store/Google Play リリース（任意）

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
| Phase 7: Mobile | 13 | 0 | 0% | 🔴 未着手 |
| Phase 8: テスト & ドキュメント | 12 | 0 | 0% | 🔴 未着手 |
| Phase 9: App Store リリース | 10 | 0 | 0% | 🔴 未着手 |
| **合計** | **138** | **103** | **75%** | 🟡 進行中 |

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

**Phase 5とPhase 6が完了しました！**

次は **Phase 7: Mobile アプリ（Expo）** に進みます。

### Phase 7の概要
- Expo + React Nativeを使用したモバイルアプリケーション開発
- 共通アプリ型（全ユーザーが同じアプリを使用）
- 初期設定でPages Functions URLを入力
- Firebase Client SDK不要（すべてAPI経由）
- Webで実装した機能をモバイルで再現

### 推奨される開始手順
1. `apps/mobile` ディレクトリの確認・セットアップ
2. React Navigation設定
3. `packages/shared/api` を活用したAPI連携
4. InitScreen（URL入力）の実装
5. AuthScreen（ログイン/登録）の実装
6. HomeScreen（記事一覧）の実装

詳細は `DESIGN.md` Section 7「モバイルアプリのアーキテクチャ」を参照してください。
