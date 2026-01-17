# Supabase セットアップガイド

このガイドでは、FeedOwn用のSupabaseプロジェクトをセットアップする手順を説明します。

## 1. Supabaseプロジェクト作成

1. [supabase.com](https://supabase.com) にアクセス
2. 「Start your project」をクリック
3. GitHubでサインイン
4. 「New Project」をクリック
5. プロジェクト名、データベースパスワード、リージョンを設定
6. 「Create new project」をクリック

## 2. データベーススキーマ作成

Supabaseダッシュボードで「SQL Editor」を開き、以下のSQLを実行します。

### テーブル作成

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

-- 既読記事（正規化テーブル）
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

-- おすすめフィード（公開データ、管理者がPythonスクリプトで更新）
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

### インデックス作成

```sql
-- パフォーマンス向上のためのインデックス
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

### Row Level Security (RLS) 設定

```sql
-- RLS有効化
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE read_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommended_feeds ENABLE ROW LEVEL SECURITY;

-- ポリシー作成: 自分のデータのみアクセス可能
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

-- recommended_feeds は公開テーブル（誰でも読み取り可能）
CREATE POLICY "Anyone can read active recommended feeds" ON recommended_feeds
  FOR SELECT USING (is_active = true);
```

## 3. Realtime有効化

1. Supabaseダッシュボードで「Database」→「Replication」を開く
2. 「Tables」タブで以下のテーブルを有効化:
   - `articles` (新着記事のリアルタイム通知用)

または、SQLで設定:

```sql
-- articlesテーブルのRealtime有効化
ALTER PUBLICATION supabase_realtime ADD TABLE articles;
```

## 4. APIキー取得

1. Supabaseダッシュボードで「Settings」→「API」を開く
2. 以下の値をコピー:
   - **Project URL**: `https://abcdefghij.supabase.co`
   - **anon/public key**: フロントエンドで使用
   - **service_role key**: バックエンドで使用（秘密）

## 5. 環境変数設定

### フロントエンド (.env.shared)

```env
VITE_SUPABASE_URL=https://abcdefghij.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_WORKER_URL=https://feedown-worker.username.workers.dev
```

### バックエンド (Cloudflare Pages Secrets)

Cloudflare Pagesダッシュボードで「Settings」→「Environment variables」に設定:

| 変数名 | 値 |
|--------|-----|
| `SUPABASE_URL` | `https://abcdefghij.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

## 6. おすすめフィードの初期データ投入

おすすめフィードはPythonスクリプトで管理します。

```bash
# 依存関係インストール
pip install -r scripts/requirements.txt

# .env.shared に SUPABASE_SERVICE_ROLE_KEY を設定してから実行
python scripts/sync_recommended_feeds.py
```

### フィード管理コマンド

```bash
# DBに同期（通常の使い方）
python scripts/sync_recommended_feeds.py

# 追加前にフィードURLをテスト
python scripts/sync_recommended_feeds.py --test "https://example.com/feed.xml"

# 全フィードの検証（パース可能か確認）
python scripts/sync_recommended_feeds.py --check
```

フィードを追加・削除する場合は、`scripts/sync_recommended_feeds.py` 内の `RECOMMENDED_FEEDS` リストを編集して再実行します。新しいフィードを追加する前に `--test` でパース可能か確認することを推奨します。

## 7. 認証設定

1. Supabaseダッシュボードで「Authentication」→「Providers」を開く
2. 「Email」が有効になっていることを確認
3. 設定を調整:
   - **Allow new users to sign up**: オン
   - **Allow manual linking**: オフ
   - **Allow anonymous sign-ins**: オフ
   - **Confirm email**: オフ

## 8. 動作確認

1. アプリをローカルで起動: `yarn dev:web`
2. 新規アカウント作成
3. フィード追加
4. 記事一覧が表示されることを確認

## トラブルシューティング

### RLSエラー

```
ERROR: new row violates row-level security policy
```

→ RLSポリシーが正しく設定されているか確認。`auth.uid()`が正しくユーザーIDと一致しているか確認。

### 認証エラー

```
ERROR: Invalid JWT
```

→ 環境変数の`SUPABASE_URL`と`SUPABASE_ANON_KEY`が正しいか確認。

### Realtimeが動作しない

→ `articles`テーブルがReplication設定で有効になっているか確認。

## 参考リンク

- [Supabase Documentation](https://supabase.com/docs)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Realtime](https://supabase.com/docs/guides/realtime)
