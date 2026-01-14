# FeedOwn - セルフホスト型 RSS リーダー 仕様書

## 概要
**FeedOwn** は、各ユーザーが自分のSupabaseとCloudflareアカウントで運用できるOSS RSSリーダー。「Own your feeds, own your data」をコンセプトに、データの完全な所有権をユーザーに提供。

## プロジェクト情報
- **プロジェクト名**: FeedOwn
- **リポジトリ**: feedown/feedown
- **キャッチコピー**: "Own your feeds, own your data"
- **ライセンス**: MIT

## 技術スタック

### フロントエンド
- **Web**: Vite + React + JavaScript
- **Mobile**: React Native (Expo) + JavaScript

### バックエンド
- **ホスティング**: Cloudflare Pages + Pages Functions
- **Workers**: Cloudflare Workers（RSS取得・CORS回避）
- **データベース**: Supabase PostgreSQL
- **認証**: Supabase Auth（メール/パスワード）
- **リアルタイム**: Supabase Realtime
- **キャッシュ**: Cloudflare KV

## 機能要件

### コア機能
| 機能 | Web | Mobile |
|------|-----|--------|
| フィード追加・削除 | ✅ | ✅ |
| フィード一覧表示 | ✅ | ✅ |
| 記事一覧表示 | ✅ | ✅ |
| 記事詳細表示 | ✅ | ✅ |
| 既読管理 | ✅ | ✅ |
| お気に入り | ✅ | ✅ |
| リアルタイム更新 | ✅ | ✅ |
| OPMLインポート/エクスポート | ✅ | ❌ |
| プルトゥリフレッシュ | ✅ | ✅ |

### フィード更新タイミング
1. **リアルタイム**: Supabase Realtimeで新着記事を即時通知
2. アプリ/Web起動時に自動更新（6時間以上経過時）
3. Refreshボタンで手動更新

### 制限
- 最大100フィードまで登録可能（テストアカウントは3フィード）
- 記事は7日間保存（TTL）
- お気に入りは無期限保存

## プロジェクト構造

```
feedown/
├── apps/
│   ├── web/                 # Vite + React
│   │   ├── src/
│   │   ├── public/
│   │   └── package.json
│   └── mobile/              # Expo (React Native)
│       ├── src/
│       └── package.json
├── packages/
│   └── shared/              # 共通ロジック
│       ├── api/             # API client
│       ├── types/           # TypeScript型定義
│       └── utils/           # ユーティリティ
├── workers/                 # Cloudflare Workers
│   ├── src/
│   │   └── index.ts
│   └── wrangler.toml
├── functions/               # Cloudflare Pages Functions
│   ├── api/
│   │   ├── auth/
│   │   ├── feeds/
│   │   ├── articles/
│   │   └── user/
│   └── lib/
│       ├── supabase.ts      # Supabaseクライアント
│       └── auth.ts          # 認証ミドルウェア
├── docs/
│   ├── DESIGN.md
│   ├── PROGRESS.md
│   ├── HANDOFF.md
│   └── SUPABASE_SETUP.md
└── README.md
```

## APIエンドポイント

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| POST | /api/auth/login | ログイン |
| POST | /api/auth/register | 新規登録 |
| GET | /api/feeds | フィード一覧取得 |
| POST | /api/feeds | フィード追加 |
| DELETE | /api/feeds/:id | フィード削除 |
| PATCH | /api/feeds/:id | フィード更新（順序） |
| POST | /api/refresh | フィード更新 |
| GET | /api/articles | 記事一覧取得 |
| POST | /api/articles/:id/read | 既読マーク |
| POST | /api/articles/batch-read | バッチ既読マーク |
| POST | /api/articles/:id/favorite | お気に入り追加 |
| DELETE | /api/articles/:id/favorite | お気に入り削除 |
| GET | /api/favorites | お気に入り一覧 |
| DELETE | /api/user/data | データクリア |
| DELETE | /api/user/account | アカウント削除 |

## データベース構造（Supabase PostgreSQL）

```sql
-- フィード
feeds (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  favicon_url TEXT,
  added_at TIMESTAMPTZ,
  last_fetched_at TIMESTAMPTZ,
  error_count INTEGER,
  "order" BIGINT
)

-- 記事
articles (
  id TEXT PRIMARY KEY,  -- SHA256ハッシュ
  user_id UUID REFERENCES auth.users(id),
  feed_id UUID REFERENCES feeds(id),
  title TEXT,
  url TEXT,
  description TEXT,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,  -- 7日TTL
  image_url TEXT
)

-- 既読記事
read_articles (
  user_id UUID,
  article_id TEXT,
  read_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, article_id)
)

-- お気に入り
favorites (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT,
  url TEXT,
  description TEXT,
  feed_title TEXT,
  saved_at TIMESTAMPTZ
)
```

## 画面構成

### Web (`feedown.pages.dev`)
```
/                    # ログイン/新規登録画面
/dashboard          # ダッシュボード（記事一覧）
/feeds              # フィード管理
/favorites          # お気に入り
/settings           # 設定
/article/:id        # 記事詳細
```

### Mobile
```
InitScreen          # 初期設定（URL入力）
AuthScreen          # ログイン/新規登録
HomeScreen          # 記事一覧
FavoritesScreen     # お気に入り
ArticleScreen       # 記事詳細
SettingsScreen      # 設定
```

## ユーザーフロー

### 初期セットアップ
```
1. Supabase プロジェクト作成
2. テーブル・RLS作成（SQLエディタ）
3. Cloudflare Pages デプロイ
4. 環境変数設定
5. デプロイ完了 → https://feedown-{username}.pages.dev
```

### Web利用
```
1. https://feedown-{username}.pages.dev アクセス
2. 新規登録 or ログイン
3. フィード追加（URL入力）
4. 記事閲覧（リアルタイム更新）
```

### モバイル利用
```
1. FeedOwn アプリダウンロード
2. 初期設定で Web URL 入力
3. ログイン（Webと同じアカウント）
4. 記事閲覧
```

## 環境変数

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

### Workers (wrangler.toml)
```toml
name = "feedown-worker"
main = "src/index.ts"

[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"
```

## パフォーマンス目標
- 100フィードの更新: 30秒以内
- 記事一覧表示: 2秒以内
- リアルタイム更新: 1秒以内
- 既読マーク反映: 即座（楽観的UI更新）

## 無料枠での運用

### Supabase
| サービス | 制限 |
|---------|------|
| Database | 500MB |
| Auth | 50,000 MAU |
| Realtime | 200同時接続 |
| API | 帯域制限のみ（リクエスト数無制限） |

### Cloudflare
| サービス | 制限 |
|---------|------|
| Workers | 10万req/日 |
| KV | 10万read/日 |
| Pages | 無制限ビルド |

**結論**: Supabase + Cloudflareで実質無料運用可能

## UI/UXガイドライン
- **カラーテーマ**: オレンジ（#FF6B35）をメインカラー、ダークモード対応
- **フォント**: システムフォント優先
- **レスポンシブ**: モバイルファースト
- **アニメーション**: 最小限、60fps維持

## セキュリティ
- **RLS**: Supabase Row Level Securityで各ユーザーのデータを分離
- **CORS**: Cloudflare Workers で制御
- **認証トークン**: Supabase JWTを使用

## 今後の拡張予定（v2以降）
- カテゴリ分け機能
- 検索機能
- 記事のアーカイブ
- 複数アカウント対応
- PWA対応

## リリース計画
1. **v1.0.0**: Supabase移行完了
2. **v1.1.0**: Mobile アプリリリース
3. **v2.0.0**: 検索・カテゴリ機能追加
