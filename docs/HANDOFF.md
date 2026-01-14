# FeedOwn 引継ぎメモ

## 現在のステータス

**デプロイURL**: https://feedown.pages.dev
**更新日**: 2026-01-15
**現在の作業**: Supabase移行（Phase 8）

| Phase | 状態 |
|-------|------|
| Phase 5: Web UI | ✅ 完了 |
| Phase 6: Cloudflare Pages | ✅ 完了 |
| Phase 7: Firestore最適化 | ✅ 完了 |
| Phase 8: Supabase移行 | 🟡 進行中 |

---

## 🔥 Supabase移行作業

### 移行理由
- Firestore無料枠の制限（読み取り5万件/日、書き込み2万件/日）にすぐ到達
- Supabaseは帯域制限のみでリクエスト数無制限
- リアルタイム更新機能を追加したい

### 移行計画の詳細
詳細な計画は `C:\Users\all\.claude\plans\lucky-enchanting-axolotl.md` を参照

### データベーススキーマ（Supabase）

```sql
-- テーブル: feeds, articles, read_articles, favorites, user_profiles
-- 詳細は docs/DESIGN.md を参照
```

---

## アーキテクチャ概要（移行後）

```
apps/web/          → React SPA (Vite) + Supabase Auth
functions/         → Cloudflare Pages Functions (API) + Supabase Client
workers/           → Cloudflare Workers (RSSプロキシ + KVキャッシュ)
packages/shared/   → 共通コード
```

### 主要なデータフロー

1. **認証**: Supabase Auth（フロントエンド直接）
2. **RSS取得**: Dashboard → `/api/refresh` → Workers → RSS配信元 → Supabase PostgreSQL
3. **リアルタイム更新**: Supabase Realtime（WebSocket）→ クライアント

### 新しいデータ構造（PostgreSQL）

```
feeds              # 登録フィード
articles           # 記事（SHA-256ハッシュID、7日TTL）
read_articles      # 既読（正規化テーブル）
favorites          # お気に入り
user_profiles      # ユーザー情報拡張
```

---

## 環境変数（移行後）

### Frontend (.env.shared)
```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_WORKER_URL=https://feedown-worker.<username>.workers.dev
```

### Backend (Cloudflare Pages secrets)
```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 移行手順

### Step 1: Supabase準備
1. Supabaseプロジェクト作成（作成済み）
2. SQLエディタでテーブル作成（docs/DESIGN.mdのスキーマ）
3. RLSポリシー設定
4. articlesテーブルのRealtime有効化

### Step 2: バックエンド移行
1. `functions/lib/supabase.ts` 新規作成
2. `functions/lib/auth.ts` 書き換え
3. 各APIエンドポイント移行（Firestore → PostgreSQL）
4. `functions/lib/firebase-rest.ts` 削除

### Step 3: フロントエンド移行
1. `apps/web/src/main.jsx` Supabase初期化
2. `apps/web/src/App.jsx` 認証状態管理
3. LoginPage, SettingsPage 認証メソッド変更
4. APIトークン取得を `supabase.auth.getSession()` に変更

### Step 4: リアルタイム実装
1. `useRealtimeArticles.js` フック作成
2. DashboardPageでRealtime購読
3. 新着記事を即座にUI反映

---

## 開発コマンド

```bash
# ローカル開発
cd apps/web && npm run dev

# ビルド
cd apps/web && npm run build

# デプロイ
npx wrangler pages deploy apps/web/dist --project-name=feedown
npx wrangler deploy --config workers/wrangler.toml
```

---

## 注意事項

### Cloudflare WorkersでのSupabase使用
- `@supabase/supabase-js` はCloudflare Workersと互換性あり
- `autoRefreshToken: false`, `persistSession: false` を設定
- Service Role Keyはサーバーサイドのみで使用

### RLS（Row Level Security）
- 全テーブルでRLS有効化必須
- `auth.uid() = user_id` でユーザーデータを分離
- Service Role Keyを使う場合はRLSをバイパス可能

### リアルタイム制限
- Supabase無料枠: 200同時接続
- articlesテーブルのみRealtime有効化推奨

---

## 参考ドキュメント

- [移行計画](C:\Users\all\.claude\plans\lucky-enchanting-axolotl.md)
- [設計書](docs/DESIGN.md)
- [進捗表](docs/PROGRESS.md)
- [Supabaseセットアップ](docs/SUPABASE_SETUP.md)
