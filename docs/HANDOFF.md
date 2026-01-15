# FeedOwn 引継ぎドキュメント

**最終更新**: 2026-01-15
**ステータス**: Phase 9 進行中（Expoモバイルアプリ）

---

## 現在の状態

### 完了した作業
- Firebase → Supabase 完全移行
- 全APIエンドポイントがSupabase PostgreSQLで動作
- Supabase Authによる認証
- Web UIが本番環境で稼働中
- **Expoモバイルアプリ: ボイラープレート起動・EASビルド成功**
- **Expoモバイルアプリ: Supabase認証実装完了**（サインイン、サインアップ、サインアウト、自動ログイン）

### デプロイ情報
- **本番URL（Web）**: https://feedown.pages.dev
- **Cloudflare Pages Project**: feedown
- **Supabase Project**: feedown（ダッシュボードで確認）
- **EAS Project ID**: 09e91d3a-0014-4831-b35f-9962d05db0e3

---

## 最近修正した問題

### 1. 記事がすぐに表示されない問題（2026-01-15）

**症状**: フィードを追加してDashboardに戻っても記事が表示されない。1-2分後にRefreshすると表示される。

**原因**: `GET /api/articles` のレスポンスに `Cache-Control: private, max-age=60` が設定されていた。

**修正**: `functions/api/articles/index.ts` で `Cache-Control: no-cache, no-store, must-revalidate` に変更。

### 2. React stale closure問題（2026-01-15）

**症状**: ナビゲーション後に古い関数が呼ばれる。

**修正**: `DashboardPage.jsx` で `handleRefreshRef` を使用して常に最新の関数を参照するように変更。

### 3. Delete Account エラー（以前）

**症状**: "User not allowed" エラーでアカウント削除失敗。

**原因**: Supabase Admin APIの権限問題。

**修正**: `functions/api/user/account.ts` でAuth削除をオプショナルに（データは削除、Auth recordは残る可能性あり）。

### 4. Expoモノレポビルドエラー（2026-01-15）

**症状**: EAS Buildで複数のエラーが発生。

**原因と修正**:
1. **エントリポイント問題**: `package.json`の`main`が`../../node_modules/expo/AppEntry.js`でモノレポのパスが解決できなかった
   - → `App.js`でカスタムエントリポイント作成（`registerRootComponent`使用）
   - → `main`を`./App.js`に変更

2. **module-resolverエイリアス未設定**: `utils/store`等のインポートが解決できなかった
   - → `babel.config.js`にエイリアス設定追加

3. **expo-updatesバージョン不整合**: `reactNativeFactory`が見つからないエラー
   - → `npx expo install expo-updates --fix`で正しいバージョンに更新

4. **react-native-workletsバージョン不整合**: Reanimated 4.xが0.5.x以上を要求
   - → worklets 0.5.1に更新、babelプラグインの重複削除

---

## モバイルアプリ開発（Phase 9）

### 現在の状態
- ✅ Expo Go起動成功
- ✅ EAS Build（iOS preview）成功
- ✅ Supabase認証実装完了
- 🔴 API連携は未実装（フィード・記事取得）
- 🔴 画面実装は未完了（Dashboard等）

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

### 認証実装の詳細（Step 2 完了）

**変更したファイル**:
- `src/utils/supabase.js` - Supabaseクライアント設定（新規作成）
- `src/contexts/UserContext.js` - Supabase Auth対応（signIn, signUp, signOut, getAccessToken）
- `src/scenes/signin/SignIn.js` - Supabase signInWithPassword使用
- `src/scenes/signup/SingUp.js` - Supabase signUp使用
- `src/scenes/loading/Loading.js` - 自動ログイン対応（セッション復元）
- `src/scenes/home/Home.js` - Supabase signOut使用
- `src/utils/showToast.js` - エラートースト追加

**認証フロー**:
1. アプリ起動時にLoading画面でSupabaseセッションを確認
2. セッションがあれば自動ログイン、なければSignIn画面へ
3. UserContextでauth state changeをリッスンし、状態変更時に自動遷移

### 次のステップ
1. ~~SignIn/SignUpをSupabase Auth対応に変更~~ ✅ 完了
2. APIクライアント作成（Cloudflare Pages Functions呼び出し）
3. 画面実装（Dashboard、フィード管理、お気に入り等）

---

## 開発環境セットアップ

### 必要なもの
- Node.js 18+
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

**フロントエンド** (`apps/web/.env.shared`):
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=
```

**Cloudflare Pages** (Secrets):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WORKER_URL`

---

## アーキテクチャ

```
┌─────────────────┐     ┌─────────────────────┐
│   Web App       │────▶│  Cloudflare Pages   │
│   (React/Vite)  │     │  Functions (API)    │
└─────────────────┘     └──────────┬──────────┘
                                   │
                        ┌──────────▼──────────┐
                        │     Supabase        │
                        │  - PostgreSQL       │
                        │  - Auth             │
                        └─────────────────────┘

┌─────────────────┐     ┌─────────────────────┐
│  RSS Feeds      │────▶│  Cloudflare Worker  │
│  (External)     │     │  (Proxy + Cache)    │
└─────────────────┘     └─────────────────────┘
```

---

## データベーススキーマ

### テーブル一覧
- `user_profiles` - ユーザー情報
- `feeds` - RSSフィード
- `articles` - 記事（7日TTL）
- `read_articles` - 既読記事
- `favorites` - お気に入り

### RLS (Row Level Security)
全テーブルでRLS有効。ユーザーは自分のデータのみアクセス可能。

---

## 既知の制限事項

1. **Delete Account**: Supabase Auth recordが残る可能性あり（データは削除される）
2. **記事の有効期限**: 7日後に自動削除される設計
3. **リアルタイム更新**: 未実装（Phase 8 Step 4）

---

## 次のタスク候補

### 優先度高（Phase 9 継続）
- [x] モバイルアプリ: Supabase認証実装 ✅ 完了
- [ ] モバイルアプリ: API連携（フィード・記事取得）
- [ ] モバイルアプリ: 主要画面実装（Dashboard、フィード管理、お気に入り）

### 優先度中
- [ ] リアルタイム更新機能（Supabase Realtime）
- [ ] E2Eテスト（Playwright）
- [ ] API仕様書作成

### 優先度低
- [ ] パフォーマンス最適化
- [ ] 多言語対応
- [ ] Androidビルド確認

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
