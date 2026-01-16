# FeedOwn API仕様書

## 概要

FeedOwn APIはCloudflare Pages Functionsで実装されています。すべてのエンドポイントは `/api/` プレフィックスで始まります。

**Base URL**: `https://feedown.pages.dev/api`

---

## 認証

認証が必要なエンドポイントは、リクエストヘッダーに`Authorization`トークンを含める必要があります。

```
Authorization: Bearer <access_token>
```

トークンはログインまたは新規登録時に取得できます。

---

## エンドポイント一覧

| メソッド | エンドポイント | 認証 | 説明 |
|---------|---------------|------|------|
| POST | `/auth/login` | - | ログイン |
| POST | `/auth/register` | - | 新規登録 |
| POST | `/auth/refresh` | - | トークンリフレッシュ |
| GET | `/feeds` | 必須 | フィード一覧取得 |
| POST | `/feeds` | 必須 | フィード追加 |
| DELETE | `/feeds/:id` | 必須 | フィード削除 |
| PATCH | `/feeds/:id` | 必須 | フィード更新（順序） |
| POST | `/refresh` | 必須 | フィード更新 |
| GET | `/articles` | 必須 | 記事一覧取得 |
| POST | `/articles/:id/read` | 必須 | 既読マーク |
| POST | `/articles/batch-read` | 必須 | バッチ既読マーク |
| POST | `/articles/:id/favorite` | 必須 | お気に入り追加 |
| DELETE | `/articles/:id/favorite` | 必須 | お気に入り削除 |
| GET | `/favorites` | 必須 | お気に入り一覧取得 |
| DELETE | `/user/data` | 必須 | データクリア |
| DELETE | `/user/account` | 必須 | アカウント削除 |
| GET | `/recommended-feeds` | - | おすすめフィード一覧 |
| GET | `/article-content` | - | 記事コンテンツ抽出 |

---

## 認証 API

### POST /api/auth/login

ユーザーログイン（モバイルアプリ用）。

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

または、既存のアクセストークンを検証:

```json
{
  "accessToken": "eyJhbG..."
}
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "uid": "uuid-string",
    "email": "user@example.com"
  },
  "token": "eyJhbG...",
  "refreshToken": "eyJhbG..."
}
```

**Error Responses:**
- `400`: Email/password or access token required
- `401`: Invalid email or password / Invalid token
- `500`: Login failed

**Notes:**
- `token`（アクセストークン）は約1時間で期限切れ
- `refreshToken`を使って新しいトークンを取得可能（`/auth/refresh`参照）

---

### POST /api/auth/register

新規ユーザー登録。

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (201):**
```json
{
  "success": true,
  "user": {
    "uid": "uuid-string",
    "email": "user@example.com"
  },
  "token": "eyJhbG...",
  "refreshToken": "eyJhbG..."
}
```

**Error Responses:**
- `400`: Email and password are required
- `400`: Password must be at least 6 characters
- `400`: Email already registered
- `500`: Registration failed

**Notes:**
- `token`（アクセストークン）は約1時間で期限切れ
- `refreshToken`を使って新しいトークンを取得可能（`/auth/refresh`参照）

---

### POST /api/auth/refresh

アクセストークンをリフレッシュ。

**Request Body:**
```json
{
  "refreshToken": "eyJhbG..."
}
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "uid": "uuid-string",
    "email": "user@example.com"
  },
  "token": "eyJhbG...",
  "refreshToken": "eyJhbG..."
}
```

**Error Responses:**
- `400`: Refresh token is required
- `401`: Token refresh failed. Please login again.
- `500`: Token refresh failed

**Notes:**
- アクセストークンが期限切れになる前（または401エラー発生時）にこのエンドポイントを呼び出す
- 新しい`refreshToken`も返されるので、次回のリフレッシュ用に保存すること
- リフレッシュに失敗した場合は再ログインが必要

---

## フィード API

### GET /api/feeds

ユーザーのフィード一覧を取得。

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "feeds": [
    {
      "id": "uuid-string",
      "url": "https://example.com/feed.xml",
      "title": "Example Feed",
      "description": "Feed description",
      "faviconUrl": "https://www.google.com/s2/favicons?domain=example.com&sz=32",
      "addedAt": "2025-01-15T10:00:00Z",
      "lastFetchedAt": "2025-01-16T08:00:00Z",
      "lastSuccessAt": "2025-01-16T08:00:00Z",
      "errorCount": 0,
      "order": 1705312000000
    }
  ]
}
```

---

### POST /api/feeds

新しいフィードを追加。

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "url": "https://example.com/feed.xml",
  "title": "Optional title",
  "description": "Optional description"
}
```

**Response (201):**
```json
{
  "feed": {
    "id": "uuid-string",
    "url": "https://example.com/feed.xml",
    "title": "Example Feed",
    "description": "Feed description",
    "faviconUrl": "https://www.google.com/s2/favicons?domain=example.com&sz=32",
    "addedAt": "2025-01-16T10:00:00Z",
    "lastFetchedAt": null,
    "lastSuccessAt": null,
    "errorCount": 0,
    "order": 1705398000000
  }
}
```

**Error Responses:**
- `400`: Feed URL is required
- `400`: Feed already exists
- `400`: Test accounts can only have up to 3 feeds (テストアカウント制限)
- `400`: Maximum 100 feeds allowed
- `401`: Unauthorized
- `500`: Failed to add feed

---

### DELETE /api/feeds/:id

フィードを削除（関連する記事もCASCADE削除）。

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true
}
```

**Error Responses:**
- `400`: Feed ID is required
- `404`: Feed not found
- `401`: Unauthorized
- `500`: Failed to delete feed

---

### PATCH /api/feeds/:id

フィードの順序を更新。

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "order": 1705398000000
}
```

**Response (200):**
```json
{
  "success": true
}
```

**Error Responses:**
- `400`: Feed ID is required
- `400`: Order field is required
- `404`: Feed not found
- `401`: Unauthorized
- `500`: Failed to update feed

---

## 記事 API

### GET /api/articles

記事一覧を取得。

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `feedId` | string | - | 特定フィードの記事のみ取得 |
| `limit` | number | 50 | 取得件数（最大100） |
| `offset` | number | 0 | オフセット |
| `unreadOnly` | boolean | false | 未読のみ取得 |

**Response (200):**
```json
{
  "articles": [
    {
      "id": "hash-string",
      "feedId": "uuid-string",
      "feedTitle": "Example Feed",
      "title": "Article Title",
      "url": "https://example.com/article",
      "description": "Article description...",
      "publishedAt": "2025-01-16T08:00:00Z",
      "fetchedAt": "2025-01-16T09:00:00Z",
      "expiresAt": "2025-01-23T09:00:00Z",
      "author": "Author Name",
      "imageUrl": "https://example.com/image.jpg",
      "isRead": false
    }
  ],
  "shouldRefresh": false,
  "hasMore": true
}
```

**Notes:**
- `shouldRefresh`: 最終更新から6時間以上経過している場合は`true`
- 記事は7日後に自動削除（`expires_at`）

---

### POST /api/articles/:id/read

記事を既読マーク。

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true
}
```

**Notes:**
- 既読マークは非クリティカルな操作のため、エラーが発生しても`200`を返す

---

### POST /api/articles/batch-read

複数の記事を一括で既読マーク。

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "articleIds": ["hash1", "hash2", "hash3"]
}
```

**Response (200):**
```json
{
  "success": true,
  "added": 3,
  "total": 15
}
```

---

### POST /api/articles/:id/favorite

記事をお気に入りに追加。

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "title": "Article Title",
  "url": "https://example.com/article",
  "description": "Article description",
  "feedTitle": "Feed Name",
  "imageUrl": "https://example.com/image.jpg"
}
```

**Response (200):**
```json
{
  "success": true
}
```

**Error Responses:**
- `400`: Article ID is required
- `400`: Article title and URL are required
- `400`: Test accounts can only have up to 10 favorites
- `401`: Unauthorized
- `500`: Failed to add to favorites

---

### DELETE /api/articles/:id/favorite

記事をお気に入りから削除。

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true
}
```

---

## お気に入り API

### GET /api/favorites

お気に入り一覧を取得。

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "favorites": [
    {
      "articleId": "hash-string",
      "title": "Article Title",
      "description": "Article description",
      "url": "https://example.com/article",
      "feedTitle": "Feed Name",
      "imageUrl": "https://example.com/image.jpg",
      "createdAt": "2025-01-16T10:00:00Z"
    }
  ]
}
```

---

## リフレッシュ API

### POST /api/refresh

すべてのフィードを更新し、新しい記事を取得。

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "message": "Refresh complete",
  "stats": {
    "totalFeeds": 5,
    "successfulFeeds": 4,
    "failedFeeds": 1,
    "newArticles": 23,
    "failedFeedDetails": [
      {
        "feedId": "uuid-string",
        "feedTitle": "Failed Feed",
        "feedUrl": "https://example.com/broken.xml",
        "error": "HTTP 404: Not Found"
      }
    ]
  },
  "feeds": [...],
  "shouldRefreshArticles": true
}
```

**Notes:**
- RSS XMLはCloudflare Workers経由で取得（キャッシュ回避）
- 記事は7日間のTTLで保存
- 既存の記事IDと照合して重複を防止

---

## ユーザー API

### DELETE /api/user/data

ユーザーデータをすべてクリア（アカウントは保持）。

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "All data cleared successfully. Your account remains active."
}
```

**削除されるデータ:**
- feeds（フィード）
- articles（記事）
- read_articles（既読記録）
- favorites（お気に入り）

---

### DELETE /api/user/account

ユーザーアカウントを完全に削除。

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

**削除されるもの:**
- すべてのユーザーデータ
- user_profiles
- Supabase Auth ユーザー（可能な場合）

---

## 公開 API

### GET /api/recommended-feeds

おすすめフィード一覧を取得（認証不要）。

**Response (200):**
```json
{
  "feeds": [
    {
      "name": "Tech News",
      "url": "https://example.com/tech.xml"
    },
    {
      "name": "Science Daily",
      "url": "https://example.com/science.xml"
    }
  ]
}
```

**Headers:**
- `Cache-Control: no-store, no-cache, must-revalidate`（キャッシュ無効）

---

### GET /api/article-content

記事URLから本文を抽出（Reader Mode用）。

**Query Parameters:**
| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `url` | string | Yes | 記事のURL |

**Response (200):**
```json
{
  "success": true,
  "article": {
    "title": "Article Title",
    "content": "<div>Cleaned HTML content...</div>",
    "textContent": "Plain text content...",
    "excerpt": "Short excerpt...",
    "byline": "By Author Name",
    "siteName": "Example Site",
    "length": 5000
  }
}
```

**Error Responses:**
- `400`: URL parameter is required
- `400`: Invalid URL provided
- `502`: Failed to fetch article

**Notes:**
- `linkedom` + `@mozilla/readability` で記事本文を抽出
- 相対URLは絶対URLに変換済み
- 1時間キャッシュ

---

## エラーレスポンス

すべてのエラーは以下の形式で返されます:

```json
{
  "error": "Error message description"
}
```

### 共通エラーコード

| コード | 説明 |
|--------|------|
| 400 | Bad Request - リクエストが不正 |
| 401 | Unauthorized - 認証が必要または無効 |
| 404 | Not Found - リソースが見つからない |
| 500 | Internal Server Error - サーバーエラー |
| 502 | Bad Gateway - 外部サービスエラー |

---

## テストアカウント制限

メールアドレスが `test` を含む、または `@test.com` で終わるアカウントは以下の制限があります:

| リソース | 制限 |
|---------|------|
| フィード | 最大3個 |
| お気に入り | 最大10個 |

---

## レート制限

Cloudflare Pages Functionsの無料枠制限:
- 10万リクエスト/日

Supabaseの無料枠:
- APIリクエスト: 帯域制限のみ（リクエスト数無制限）

---

## Workers API (RSS Proxy)

RSS取得プロキシは別のCloudflare Workersで動作します。

### GET /fetch

RSSフィードをフェッチして返します。

**Base URL**: `https://feedown-worker.{subdomain}.workers.dev`

**Query Parameters:**
| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `url` | string | Yes | RSSフィードのURL |
| `bypass_cache` | string | No | `1`でキャッシュをバイパス |

**Response:**
- `Content-Type: application/xml` または `text/xml`
- RSSフィードのXMLコンテンツ

**Notes:**
- KVキャッシュ（TTL: 1時間）
- CORS対応
