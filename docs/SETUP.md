# FeedOwn セットアップガイド

このガイドでは、FeedOwnを自分のSupabaseとCloudflareアカウントにデプロイする手順を説明します。

## 目次

1. [前提条件](#前提条件)
2. [Supabaseセットアップ](#1-supabaseセットアップ)
3. [Cloudflare Workersセットアップ](#2-cloudflare-workersセットアップ)
4. [Cloudflare Pagesセットアップ](#3-cloudflare-pagesセットアップ)
5. [ローカル開発環境](#4-ローカル開発環境)
6. [モバイルアプリビルド](#5-モバイルアプリビルド)
7. [トラブルシューティング](#トラブルシューティング)

---

## 前提条件

### 必要なアカウント

| サービス | 用途 | 無料枠 |
|---------|------|--------|
| [Supabase](https://supabase.com) | データベース・認証 | 500MB DB, 50,000 MAU |
| [Cloudflare](https://cloudflare.com) | ホスティング・Workers | 10万req/日 |
| [Expo](https://expo.dev) (オプション) | モバイルアプリビルド | 30ビルド/月 |

### 必要なツール

```bash
# Node.js (v22以上推奨)
node --version  # v22.19.0+

# npm または yarn
npm --version   # v10+

# Wrangler CLI (Cloudflare)
npm install -g wrangler

# Git
git --version
```

---

## 1. Supabaseセットアップ

### 1.1 プロジェクト作成

1. [supabase.com](https://supabase.com) にアクセス
2. 「Start your project」→ GitHubでサインイン
3. 「New Project」をクリック
4. 設定:
   - **Project name**: `feedown` (任意)
   - **Database Password**: 安全なパスワードを設定
   - **Region**: 最寄りのリージョン

### 1.2 データベーススキーマ作成

Supabaseダッシュボードで「SQL Editor」を開き、以下のSQLを実行します。

**テーブル作成:**

```sql
-- ユーザープロファイル（auth.usersの拡張）
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  is_test_account BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- フィード
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

-- 記事（7日TTL）
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

-- 既読記事
CREATE TABLE read_articles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, article_id)
);

-- お気に入り（無期限保存）
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

-- おすすめフィード（公開データ）
CREATE TABLE recommended_feeds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**インデックス作成:**

```sql
CREATE INDEX idx_feeds_user_id ON feeds(user_id);
CREATE INDEX idx_feeds_order ON feeds(user_id, "order");
CREATE INDEX idx_articles_user_id ON articles(user_id);
CREATE INDEX idx_articles_feed_id ON articles(feed_id);
CREATE INDEX idx_articles_expires_at ON articles(expires_at);
CREATE INDEX idx_articles_published_at ON articles(user_id, published_at DESC);
CREATE INDEX idx_read_articles_user_id ON read_articles(user_id);
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_saved_at ON favorites(user_id, saved_at DESC);
CREATE INDEX idx_recommended_feeds_order ON recommended_feeds(sort_order);
```

**Row Level Security (RLS) 設定:**

```sql
-- RLS有効化
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE read_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommended_feeds ENABLE ROW LEVEL SECURITY;

-- ポリシー作成
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

-- recommended_feedsは公開（誰でも読み取り可能）
CREATE POLICY "Anyone can read active recommended feeds" ON recommended_feeds
  FOR SELECT USING (is_active = true);
```

### 1.3 APIキー取得

1. Supabaseダッシュボード → 「Settings」 → 「API」
2. 以下の値をメモ:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: フロントエンドで使用
   - **service_role key**: バックエンドで使用（秘密）

### 1.4 認証設定

1. Supabaseダッシュボード → 「Authentication」 → 「Providers」
2. 「Email」を有効化
3. 「Confirm email」を**オフ**に設定（メール確認なしで即座にログイン可能）

---

## 2. Cloudflare Workersセットアップ

WorkersはRSSフィードを取得するプロキシとして機能します。

### 2.1 Cloudflareアカウント準備

1. [dash.cloudflare.com](https://dash.cloudflare.com) にアクセス
2. サインインまたはアカウント作成
3. Account IDをメモ（右サイドバーに表示）

### 2.2 KV Namespace作成

```bash
# Wranglerにログイン
wrangler login

# KV Namespace作成
wrangler kv namespace create "CACHE"
# => 出力されるIDをメモ

# Preview用KV Namespace作成
wrangler kv namespace create "CACHE" --preview
# => 出力されるpreview_idをメモ
```

### 2.3 wrangler.toml設定

`workers/wrangler.toml` を編集:

```toml
name = "feedown-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# あなたのAccount ID
account_id = "your-account-id"

# KV Namespace
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-id"
preview_id = "your-preview-kv-id"

[observability]
enabled = true
```

### 2.4 Workersデプロイ

```bash
cd workers
npm install
wrangler deploy
```

デプロイ後、Worker URLをメモ: `https://feedown-worker.your-subdomain.workers.dev`

---

## 3. Cloudflare Pagesセットアップ

### 3.1 リポジトリ準備

```bash
# リポジトリをクローン
git clone https://github.com/kiyohken2000/feedown.git
cd feedown

# 依存関係インストール
npm install
```

### 3.2 環境変数設定

`.env.example` をコピーして `.env.shared` を作成し、値を入力:

```bash
# ルートディレクトリで実行
cp .env.example .env.shared
```

`.env.shared` を編集:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Cloudflare Workers URL
VITE_WORKER_URL=https://feedown-worker.your-subdomain.workers.dev

# App Configuration
VITE_APP_NAME=FeedOwn
VITE_APP_VERSION=1.0.0
VITE_API_BASE_URL=
```

同期スクリプトを実行して `apps/web/.env` を生成:

```bash
bash scripts/sync-envs.sh
```

これにより `.env.shared` の内容が `apps/web/.env` にコピーされます。

### 3.3 ビルドとデプロイ

```bash
# ルートディレクトリから実行すること！
npm run build:web

# Pagesにデプロイ
npx wrangler pages deploy apps/web/dist --project-name=feedown
```

**重要**: 必ず**ルートディレクトリ**からデプロイしてください。`apps/web`からデプロイすると`functions`フォルダが含まれず、APIが動作しません。

### 3.4 環境変数をCloudflare Pagesに設定

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages → feedown → Settings → Environment variables
2. 以下の変数を追加:

| 変数名 | 値 | 備考 |
|--------|-----|------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | |
| `SUPABASE_ANON_KEY` | `eyJhbG...` | |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbG...` | **Secret** |
| `WORKER_URL` | `https://feedown-worker.xxx.workers.dev` | |

3. 変更を保存し、再デプロイ

### 3.5 動作確認

デプロイ後のURL（例: `https://feedown.pages.dev`）にアクセスし、以下を確認:

1. ログイン画面が表示される
2. 新規アカウント作成ができる
3. フィード追加ができる
4. 記事が表示される

---

## 4. ローカル開発環境

### 4.1 依存関係インストール

```bash
cd feedown
npm install
```

### 4.2 環境変数設定

`apps/web/.env` を作成（上記参照）

### 4.3 開発サーバー起動

**ターミナル1: Vite開発サーバー**
```bash
npm run dev:web
# => http://localhost:5173
```

**ターミナル2: Wrangler Pages（APIサーバー）**
```bash
cd apps/web
npx wrangler pages dev dist \
  --compatibility-date=2024-01-01 \
  --compatibility-flags=nodejs_compat \
  --binding SUPABASE_URL=https://xxxxx.supabase.co \
  --binding SUPABASE_ANON_KEY=your-anon-key \
  --binding SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  --binding WORKER_URL=https://feedown-worker.xxx.workers.dev
# => http://localhost:8788
```

### 4.4 開発時のアクセス

- **フロントエンド**: http://localhost:5173
- **API**: http://localhost:8788/api/*

---

## 5. モバイルアプリビルド

### 5.1 EAS CLIセットアップ

```bash
npm install -g eas-cli
eas login
```

### 5.2 EASプロジェクト作成

```bash
cd apps/mobile
eas init
```

### 5.3 eas.json設定

`apps/mobile/eas.json`:

```json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      },
      "android": {
        "buildType": "apk"
      },
      "env": {
        "NODE_VERSION": "22.19.0"
      }
    },
    "production": {
      "env": {
        "NODE_VERSION": "22.19.0"
      }
    }
  }
}
```

### 5.4 ビルド実行

```bash
cd apps/mobile

# iOS（実機用）
eas build --profile preview --platform ios

# Android（APK）
eas build --profile preview --platform android

# Expo Goで開発
npx expo start --clear
```

### 5.5 モバイルアプリの接続設定

モバイルアプリ起動時に以下を入力:
- **Server URL**: `https://feedown.pages.dev`（あなたのPages URL）
- **Email/Password**: Webで作成したアカウント

---

## トラブルシューティング

### API 405エラー

```
POST /api/feeds 405 Method Not Allowed
```

**原因**: `apps/web`ディレクトリからデプロイしている

**解決**: **ルートディレクトリから**デプロイする
```bash
cd /path/to/feedown  # ルートディレクトリ
npm run build:web
npx wrangler pages deploy apps/web/dist --project-name=feedown
```

### RLSエラー

```
ERROR: new row violates row-level security policy
```

**原因**: RLSポリシーが未設定、またはauth.uid()が取得できない

**解決**:
1. RLSポリシーが正しく設定されているか確認
2. APIリクエストにAuthorizationヘッダーが含まれているか確認

### 認証エラー

```
ERROR: Invalid JWT
```

**原因**: トークンが無効または環境変数が間違っている

**解決**:
1. `SUPABASE_URL`と`SUPABASE_ANON_KEY`が正しいか確認
2. Supabaseダッシュボードで最新のキーを取得

### 記事が表示されない

**原因**: キャッシュまたはRefresh未実行

**解決**:
1. ブラウザのキャッシュをクリア（Ctrl+Shift+R）
2. 手動でRefreshボタンをクリック
3. DevToolsのNetworkタブで「Disable cache」有効化

### モバイルアプリが起動しない

**解決**:
```bash
cd apps/mobile
npx expo start --clear
```

キャッシュをクリアして再起動

### EAS Buildエラー

**解決**:
```bash
# 依存関係を自動修正
npx expo install --fix

# eas.jsonのNodeバージョン確認
# Node 22.19.0が指定されているか確認
```

---

## おすすめフィードの管理

おすすめフィードはPythonスクリプトで管理します。

### セットアップ

```bash
cd scripts
pip install -r requirements.txt
```

### フィード追加/削除

1. `scripts/sync_recommended_feeds.py` の `RECOMMENDED_FEEDS` リストを編集
2. スクリプト実行:

```bash
# SUPABASE_SERVICE_ROLE_KEYが必要
export SUPABASE_SERVICE_ROLE_KEY=your-key
python scripts/sync_recommended_feeds.py
```

---

## 参考リンク

- [Supabase Documentation](https://supabase.com/docs)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers)
- [Expo Documentation](https://docs.expo.dev)

---

## 次のステップ

セットアップ完了後:

1. フィードを追加してみる
2. モバイルアプリをインストール
3. ダークモードを試す
4. Reader Modeで記事を読む

問題が発生した場合は、[GitHub Issues](https://github.com/kiyohken2000/feedown/issues)で報告してください。
