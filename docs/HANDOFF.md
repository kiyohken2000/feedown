# FeedOwn 引継ぎドキュメント

**最終更新**: 2026-01-15
**ステータス**: Supabase移行完了、本番稼働中

---

## 現在の状態

### 完了した作業
- Firebase → Supabase 完全移行
- 全APIエンドポイントがSupabase PostgreSQLで動作
- Supabase Authによる認証
- Web UIが本番環境で稼働中

### デプロイ情報
- **本番URL**: https://feedown.pages.dev
- **Cloudflare Pages Project**: feedown
- **Supabase Project**: feedown（ダッシュボードで確認）

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

### 優先度高
- [ ] リアルタイム更新機能（Supabase Realtime）
- [ ] モバイルアプリ（Expo）

### 優先度中
- [ ] E2Eテスト（Playwright）
- [ ] API仕様書作成

### 優先度低
- [ ] パフォーマンス最適化
- [ ] 多言語対応

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

---

## 連絡先・リソース

- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **Supabase Dashboard**: https://app.supabase.com
- **GitHub Issues**: プロジェクトのIssueトラッカー
