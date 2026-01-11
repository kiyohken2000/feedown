# FeedOwn - セルフホスト型 RSS リーダー 仕様書

## 概要
**FeedOwn** は、各ユーザーが自分のFirebaseとCloudflareアカウントで運用できるOSS RSSリーダー。「Own your feeds, own your data」をコンセプトに、データの完全な所有権をユーザーに提供。

## プロジェクト情報
- **プロジェクト名**: FeedOwn
- **リポジトリ**: feedown/feedown
- **キャッチコピー**: "Own your feeds, own your data"
- **ライセンス**: MIT

## 技術スタック

### フロントエンド
- **Web**: Vite + React + Javascript
- **Mobile**: React Native (Expo) + Javascript
- **スタイリング**: React Native Web

### バックエンド
- **ホスティング**: Cloudflare Pages + Pages Functions
- **Workers**: Cloudflare Workers（RSS取得・CORS回避）
- **データベース**: Firebase Firestore
- **認証**: Firebase Auth（メール/パスワード）
- **キャッシュ**: Cloudflare KV

## 機能要件

### コア機能
| 機能 | Web | Mobile |
|------|-----|--------|
| フィード追加・削除 | ✅ | ❌ |
| フィード一覧表示 | ✅ | ✅ |
| 記事一覧表示 | ✅ | ✅ |
| 記事詳細表示 | ✅ | ✅ |
| 既読管理 | ✅ | ✅ |
| お気に入り | ✅ | ✅ |
| OPMLインポート/エクスポート | ✅ | ❌ |
| プルトゥリフレッシュ | ✅ | ✅ |

### フィード更新タイミング
1. アプリ/Web起動時に自動更新
2. プルトゥリフレッシュで手動更新  
3. Cloudflare Cron（6時間ごと）でベースライン更新

### 制限
- 最大100フィードまで登録可能
- プッシュ通知なし
- バックグラウンド同期なし

## プロジェクト構造

```
feedown/
├── apps/
│   ├── web/                 # Vite + React + Javascript
│   │   ├── src/
│   │   ├── public/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── mobile/              # Expo (React Native) + Javascript
│       ├── src/
│       ├── app.json
│       └── package.json
├── workers/                 # Cloudflare Workers
│   ├── src/
│   │   └── index.ts
│   └── wrangler.toml
├── functions/               # Cloudflare Pages Functions
│   └── api/
│       ├── auth.ts
│       ├── feeds.ts
│       ├── articles.ts
│       ├── refresh.ts
│       └── test-feed.ts
├── docs/
│   ├── SETUP.md            # セットアップガイド
│   └── API.md              # API仕様書
├── scripts/
│   ├── sync-envs.sh        # [更新] .env.sharedを各appsへ同期するスクリプト
│   └── deploy.sh           # デプロイスクリプト
├── .env.shared             # [更新] ルートに配置する共通環境変数
├── .env.example
├── README.md
└── LICENSE
```

## APIエンドポイント

| メソッド | エンドポイント | 説明 | Web | Mobile |
|---------|---------------|------|-----|---------|
| POST | /api/auth/login | ログイン | ✅ | ✅ |
| POST | /api/auth/logout | ログアウト | ✅ | ✅ |
| POST | /api/auth/register | 新規登録 | ✅ | ✅ |
| GET | /api/feeds | フィード一覧取得 | ✅ | ✅ |
| POST | /api/feeds | フィード追加 | ✅ | ❌ |
| DELETE | /api/feeds/:id | フィード削除 | ✅ | ❌ |
| POST | /api/test-feed | フィードURL検証 | ✅ | ❌ |
| POST | /api/refresh | フィード更新 | ✅ | ✅ |
| GET | /api/articles | 記事一覧取得 | ✅ | ✅ |
| POST | /api/articles/:id/read | 既読マーク | ✅ | ✅ |
| POST | /api/articles/:id/favorite | お気に入り追加 | ✅ | ✅ |
| DELETE | /api/articles/:id/favorite | お気に入り削除 | ✅ | ✅ |
| POST | /api/opml/import | OPMLインポート | ✅ | ❌ |
| GET | /api/opml/export | OPMLエクスポート | ✅ | ❌ |

## データベース構造（Firestore）

```
users/
  └─ {userId}/
      ├─ profile/
      │   └─ data: {
      │       email: string,
      │       createdAt: timestamp
      │   }
      ├─ feeds/              # コレクション（最大100件）
      │   └─ {feedId}: {
      │       url: string,
      │       title: string,
      │       description?: string,
      │       addedAt: timestamp
      │   }
      ├─ readArticles/       # コレクション
      │   └─ {articleHash}: {
      │       readAt: timestamp
      │   }
      └─ favorites/          # コレクション
          └─ {articleHash}: {
              title: string,
              url: string,
              feedTitle: string,
              savedAt: timestamp
          }
```

## 画面構成

### Web (`feedown-{username}.pages.dev`)
```
/                    # ログイン/新規登録画面
/dashboard          # ダッシュボード（記事一覧）
/feeds              # フィード管理
/favorites          # お気に入り
/settings           # 設定
/article/:id        # 記事詳細（モーダル）
```

### Mobile
```
InitScreen          # 初期設定（URL入力）
AuthScreen          # ログイン/新規登録
HomeScreen          # 記事一覧
FavoritesScreen     # お気に入り
ArticleScreen       # 記事詳細
SettingsScreen      # 設定（URL変更など）
```

## ユーザーフロー

### 初期セットアップ
```
1. GitHub リポジトリの "Deploy to Cloudflare" ボタンクリック
2. Cloudflare Pages デプロイ（自動）
3. Firebase プロジェクト作成（ガイドに従って手動）
4. 環境変数設定
5. デプロイ完了 → https://feedown-{username}.pages.dev 取得
```

### Web利用
```
1. https://feedown-{username}.pages.dev アクセス
2. 新規登録 or ログイン
3. フィード追加（URL入力 or OPMLインポート）
4. 記事閲覧
```

### モバイル利用
```
1. FeedOwn アプリダウンロード（App Store/Google Play）
2. 初期設定で Web URL 入力
3. ログイン（Webと同じアカウント）
4. 記事閲覧
```

## 環境変数

### .env.example (Web)
```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Cloudflare Workers URL
VITE_WORKER_URL=https://feedown-worker.{username}.workers.dev

# App Configuration  
VITE_APP_NAME=FeedOwn
VITE_APP_VERSION=1.0.0
```

### wrangler.toml (Workers)
```toml
name = "feedown-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[triggers]
crons = ["0 */6 * * *"]

[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"

[vars]
FIREBASE_PROJECT_ID = "your-project-id"
```

## パフォーマンス目標
- 100フィードの更新: 30秒以内
- 記事一覧表示: 2秒以内
- 既読マーク反映: 即座（楽観的UI更新）

## 無料枠での運用制限
| サービス | 制限 | 使用予定 |
|---------|------|---------|
| Cloudflare Workers | 10万req/日 | ~5000req/日 |
| Cloudflare KV | 10万read/日 | ~2000read/日 |
| Firebase Firestore | 5万read/日 | ~3000read/日 |
| Firebase Auth | 無制限 | - |
| Cloudflare Cron | 10回/日 | 4回/日 |

## UI/UXガイドライン
- **カラーテーマ**: オレンジ（#FF6B35）をメインカラー、ダークモード対応
- **フォント**: システムフォント優先
- **レスポンシブ**: モバイルファースト
- **アニメーション**: 最小限、60fps維持

## セキュリティ
- Firebase Security Rules で各ユーザーのデータを分離
- CORS: Cloudflare Workers で制御
- 認証トークン: 1時間で自動更新

## 今後の拡張予定（v2以降）
- カテゴリ分け機能
- 検索機能
- 記事のアーカイブ
- 複数アカウント対応
- PWA対応

## リリース計画
1. **v0.1.0**: MVP（基本機能のみ）
2. **v0.5.0**: OPMLインポート/エクスポート追加
3. **v1.0.0**: 正式リリース（ドキュメント完備）