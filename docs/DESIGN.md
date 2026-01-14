# FeedOwn - 実装設計書

## 1. データ保存設計（Supabase PostgreSQL）

### データベーススキーマ

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
  id TEXT PRIMARY KEY,  -- SHA256ハッシュ(feedId:guid)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_id UUID NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  feed_title TEXT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,  -- 7日後
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

-- インデックス
CREATE INDEX idx_feeds_user_id ON feeds(user_id);
CREATE INDEX idx_feeds_order ON feeds(user_id, "order");
CREATE INDEX idx_articles_user_id ON articles(user_id);
CREATE INDEX idx_articles_feed_id ON articles(feed_id);
CREATE INDEX idx_articles_expires_at ON articles(expires_at);
CREATE INDEX idx_articles_published_at ON articles(user_id, published_at DESC);
CREATE INDEX idx_read_articles_user_id ON read_articles(user_id);
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_saved_at ON favorites(user_id, saved_at DESC);
```

### Row Level Security (RLS)

```sql
-- 全テーブルでRLS有効化
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE read_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- ポリシー: 自分のデータのみアクセス可能
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
```

### 設計理由
- **Supabase無料枠**: 500MB Database、無制限API呼び出し（帯域制限のみ）
- **正規化テーブル**: PostgreSQLの強みを活かしたスケーラブルな設計
- **TTL 7日**: 古い記事を定期削除しストレージ節約
- **RLS**: ユーザーごとのデータ分離をDB層で保証

---

## 2. Workers vs Functions の役割分担

### Cloudflare Workers (`workers/src/index.ts`)
**役割: RSS取得専用プロキシ + CORS回避**

```typescript
// GET /fetch?url={rssUrl}
// - RSS URLをfetchしてXMLを返す
// - CORSヘッダーを追加
// - KVキャッシュ (TTL: 1時間)
// - レート制限: 同じURL 1時間に1回まで
```

### Cloudflare Pages Functions (`functions/api/`)
**役割: すべてのビジネスロジック**

```
/api/auth/*          - Supabase Auth連携
/api/feeds           - フィードCRUD（PostgreSQL操作）
/api/refresh         - RSS取得 → Worker経由 → PostgreSQL保存
/api/articles        - 記事一覧取得（PostgreSQL）
/api/articles/:id/*  - 既読/お気に入り操作
/api/favorites       - お気に入り一覧
/api/user/*          - アカウント管理
```

**フロー例: `/api/refresh`**
```
Client → Pages Functions /api/refresh
         ↓
         ├─ 1. PostgreSQLからフィード一覧取得
         ├─ 2. 各フィードのRSSを Worker /fetch?url=... で取得
         ├─ 3. XMLパース → 記事データ抽出
         ├─ 4. PostgreSQL articles テーブルにupsert（バッチ）
         └─ 5. last_fetched_at更新
```

---

## 3. リアルタイム更新（Supabase Realtime）

### 仕組み
Supabase RealtimeはPostgreSQLの変更をWebSocket経由でクライアントに配信。

```javascript
// クライアント側購読
const channel = supabase
  .channel(`articles:${userId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'articles',
    filter: `user_id=eq.${userId}`,
  }, (payload) => {
    // 新着記事を即座にUIに反映
    addNewArticle(payload.new);
  })
  .subscribe();
```

### メリット
- **即時更新**: Refreshボタン不要で新着記事が表示
- **効率的**: ポーリング不要でサーバー負荷軽減
- **追加コストなし**: Supabase無料枠に含まれる

### スマートリフレッシュ（フォールバック）
```typescript
// 記事一覧取得時に自動チェック
GET /api/articles

→ last_fetched_at が 6時間以上前なら自動的に /api/refresh を呼ぶ
→ Realtimeが接続できない場合のフォールバック
```

---

## 4. KVキャッシュの使い方

### Workers側でRSS XMLをキャッシュ

```typescript
// Worker: /fetch?url={rssUrl}
const cacheKey = `rss:${MD5(rssUrl)}`;
const cached = await KV.get(cacheKey);

if (cached && Date.now() - cached.timestamp < 3600000) {
  return cached.xml;  // 1時間以内のキャッシュを返す
}

const xml = await fetch(rssUrl).then(r => r.text());
await KV.put(cacheKey, { xml, timestamp: Date.now() }, { expirationTtl: 3600 });
return xml;
```

**効果:**
- 同じRSSを短時間に複数回取得しない
- RSS配信元サーバーへの負荷軽減
- Cloudflare Workers の外部リクエスト数削減

---

## 5. WebとMobileのコード共有戦略

### モノレポ構成

```
feedown/
├── apps/
│   ├── web/              # Vite + React (Web専用UI)
│   └── mobile/           # Expo + React Native
├── packages/
│   └── shared/           # 共通ロジック
│       ├── api/          # API client (fetch wrapper)
│       ├── types/        # TypeScript型定義
│       └── utils/        # ユーティリティ関数
├── workers/              # Cloudflare Workers (RSSプロキシ)
├── functions/            # Cloudflare Pages Functions (API)
└── package.json          # ワークスペース設定
```

**共有するもの:**
- API client (認証、エンドポイント)
- ビジネスロジック（記事の既読判定、フィルタリングなど）
- TypeScript型定義

**共有しないもの:**
- UIコンポーネント（WebとMobileで別実装が現実的）
- ナビゲーション（React Router vs React Navigation）

---

## 6. モバイルアプリのアーキテクチャ

### Web vs Mobile の根本的な違い

**Webアプリ（個別デプロイ型）:**
```
各ユーザーが自分のCloudflare Pagesにデプロイ
  ↓
Supabase Client SDK直接使用（認証）
  ↓
自分のSupabase/Cloudflareにアクセス
```

**モバイルアプリ（共通アプリ型）:**
```
App Store/Google Playから共通アプリをダウンロード
  ↓
初期設定でPages Functions URL入力
  ↓
Pages Functions API経由でのみアクセス（Supabase SDK不要）
  ↓
各ユーザーのSupabase/Cloudflareにアクセス
```

### 認証フロー

**Web:**
```typescript
// Supabase Auth SDK直接使用
import { createClient } from '@supabase/supabase-js';
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});
const token = data.session?.access_token;
```

**Mobile:**
```typescript
// Pages Functions API経由
const response = await apiClient.post('/api/auth/login', { email, password });
const { token, user } = response.data;
// トークンをAsyncStorageに保存
```

---

## 7. パフォーマンス最適化

### 記事一覧取得の工夫
```sql
-- PostgreSQL クエリ
SELECT a.*,
       CASE WHEN ra.article_id IS NOT NULL THEN true ELSE false END as is_read
FROM articles a
LEFT JOIN read_articles ra ON a.id = ra.article_id AND ra.user_id = a.user_id
WHERE a.user_id = $1
  AND a.expires_at > NOW()
ORDER BY a.published_at DESC
LIMIT 50 OFFSET $2;
```

### 既読マークの楽観的UI更新
```typescript
// クライアント側で即座に反映
setReadArticles(prev => new Set([...prev, articleId]));

// バックグラウンドでAPI呼び出し
api.articles.markAsRead(articleId).catch(() => {
  // 失敗時はロールバック
  setReadArticles(prev => {
    const next = new Set(prev);
    next.delete(articleId);
    return next;
  });
});
```

### バッチ既読マーク
```typescript
// 複数記事を一括で既読マーク（500msデバウンス）
const { error } = await supabase
  .from('read_articles')
  .upsert(
    articleIds.map(id => ({ user_id: uid, article_id: id })),
    { onConflict: 'user_id,article_id' }
  );
```

---

## 8. セキュリティ設計

### Supabase Row Level Security
```sql
-- ユーザーは自分のデータのみアクセス可能
CREATE POLICY "Users can manage own data" ON feeds
  FOR ALL USING (auth.uid() = user_id);
```

### Pages Functions 認証
```typescript
// すべてのAPI呼び出しでトークン検証
const authHeader = request.headers.get('Authorization');
const token = authHeader?.replace('Bearer ', '');

const { data: { user }, error } = await supabase.auth.getUser(token);
if (error || !user) {
  return new Response('Unauthorized', { status: 401 });
}
const userId = user.id;
```

---

## 9. デプロイフロー

### 初期セットアップ
```bash
# 1. Supabase プロジェクト作成
# supabase.comでプロジェクト作成 → SQLでテーブル作成

# 2. Cloudflare Workers デプロイ
cd workers && npx wrangler deploy

# 3. Cloudflare Pages デプロイ
npx wrangler pages deploy apps/web/dist --project-name=feedown

# 4. 環境変数設定
# Pages: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# Workers: (なし、または必要に応じて)
```

---

## 10. コスト試算（Supabase無料枠での運用）

### 無料枠
| サービス | 制限 |
|---------|------|
| Database | 500MB |
| Auth | 50,000 MAU |
| Storage | 1GB |
| Realtime | 200同時接続 |
| API | 帯域制限のみ（リクエスト数無制限） |

### Cloudflare無料枠
| サービス | 制限 |
|---------|------|
| Workers | 10万req/日 |
| KV | 10万read/日、1000write/日 |
| Pages | 無制限ビルド |

### 結論
**Supabase + Cloudflareの組み合わせで、実質無料で運用可能**

従来のFirestore（読み取り5万件/日、書き込み2万件/日）と比較して大幅に緩和。

---

## 11. 環境変数

### Frontend (.env.shared)
```env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_WORKER_URL=https://feedown-worker.<username>.workers.dev
VITE_APP_NAME=FeedOwn
```

### Backend (Cloudflare Pages secrets)
```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## まとめ

この設計により:
- ✅ シンプルで理解しやすい構成
- ✅ 無料枠で余裕を持って運用可能
- ✅ リアルタイム更新でUX向上
- ✅ PostgreSQLの柔軟なクエリ
- ✅ WebとMobileのロジック共有
- ✅ セキュアなマルチテナント設計（RLS）

実装の優先順位:
1. Supabase セットアップ（テーブル作成、RLS設定）
2. Workers (RSS取得プロキシ) - 変更なし
3. Pages Functions (API) - Supabase移行
4. Web UI - Supabase Auth移行 + Realtime統合
5. Mobile - Webの後
