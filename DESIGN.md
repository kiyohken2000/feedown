# FeedOwn - 実装設計書

## 1. データ保存設計（Firestore）

### 記事データの保存方針
**記事のdescriptionをFirestoreに保存し、7日間で自動削除**

```
users/
  └─ {userId}/
      ├─ feeds/
      │   └─ {feedId}: {
      │       url: string,
      │       title: string,
      │       description?: string,
      │       lastFetchedAt: timestamp,
      │       lastSuccessAt: timestamp,
      │       errorCount: number,
      │       addedAt: timestamp
      │   }
      ├─ articles/              # 新規追加: 記事の全文保存
      │   └─ {articleHash}: {    # articleHash = MD5(feedId + article.guid)
      │       feedId: string,
      │       title: string,
      │       url: string,
      │       description: string,    # 記事のdescription
      │       publishedAt: timestamp,
      │       fetchedAt: timestamp,
      │       expiresAt: timestamp  # fetchedAt + 7日（TTL）
      │   }
      ├─ readArticles/
      │   └─ {articleHash}: {
      │       readAt: timestamp
      │   }
      └─ favorites/
          └─ {articleHash}: {
              title: string,
              url: string,
              description: string,     # お気に入りは無期限保存
              feedTitle: string,
              savedAt: timestamp
          }
```

**理由:**
- Firestoreの無料枠: 5万read/日、2万write/日
- 1日2回更新 × 100フィード × 平均10記事 = 2000 writes/日（許容範囲）
- TTL 7日で古い記事を自動削除し、ストレージコストを抑制
- オフライン閲覧可能（記事descriptionが手元にある）

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

// POST /cron (Cron Trigger: 0 */6 * * *)
// - 何もしない（Cronは使わない方針に変更 → 理由は後述）
```

### Cloudflare Pages Functions (`functions/api/`)
**役割: すべてのビジネスロジック**

```
/api/auth/*          - Firebase Auth連携
/api/feeds           - フィードCRUD（Firestore操作）
/api/refresh         - RSS取得 → Worker経由 → Firestore保存
/api/articles        - 記事一覧取得（Firestore）
/api/articles/:id/*  - 既読/お気に入り操作
/api/test-feed       - フィードURL検証（Worker経由）
/api/opml/*          - OPML インポート/エクスポート
```

**フロー例: `/api/refresh`**
```
Client → Pages Functions /api/refresh
         ↓
         ├─ 1. Firestoreからフィード一覧取得
         ├─ 2. 各フィードのRSSを Worker /fetch?url=... で取得
         ├─ 3. XMLパース → 記事データ抽出
         ├─ 4. Firestore articles/ に保存（バッチ書き込み）
         └─ 5. lastFetchedAt更新
```

---

## 3. Cron更新の廃止 → クライアント駆動に変更

### 理由
1. **認証問題**: Cronから全ユーザーのFirestoreにアクセスするにはAdmin SDK + サービスアカウントが必要
2. **コスト**: 全ユーザー分の更新を6時間ごとに実行すると無駄が多い
3. **シンプルさ**: セルフホストの思想に合わない（ユーザーがアクセスしたときだけ更新）

### 新方針: スマートリフレッシュ
```typescript
// 記事一覧取得時に自動チェック
GET /api/articles

→ lastFetchedAt が 6時間以上前なら自動的に /api/refresh を呼ぶ
→ クライアント側でバックグラウンド更新（非同期）
```

**メリット:**
- Cron不要（Cloudflare Workersの無料枠節約）
- アクティブユーザーのみ更新（コスト最適化）
- 実装がシンプル

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

### 現在の問題
- Web: Vite + React
- Mobile: Expo + React Native
- 「スタイリング: React Native Web」だが実際の共有方法が不明

### 推奨: モノレポ + 共通パッケージ

```
feedown/
├── apps/
│   ├── web/              # Vite + React (Web専用UI)
│   └── mobile/           # Expo + React Native
├── packages/
│   ├── shared/           # 新規追加: 共通ロジック
│   │   ├── api/          # API client (fetch wrapper)
│   │   ├── hooks/        # カスタムフック（useArticles, useFeedsなど）
│   │   ├── types/        # TypeScript型定義
│   │   └── utils/        # ユーティリティ関数
│   └── ui/               # 新規追加: 共通UIコンポーネント（任意）
│       └── components/   # React Native Web対応コンポーネント
├── workers/
├── functions/
└── package.json          # ワークスペース設定
```

**package.json (ルート)**
```json
{
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

**共有するもの:**
- API client (認証、エンドポイント)
- ビジネスロジック（記事の既読判定、フィルタリングなど）
- TypeScript型定義

**共有しないもの:**
- UIコンポーネント（WebとMobileで別実装が現実的）
- ナビゲーション（React Router vs React Navigation）

---

## 6. Mobile機能制限の緩和

### 現仕様: フィード追加・削除が Mobile ❌

### 提案: すべて実装可能にする

**理由:**
- 技術的制限はない（同じAPI使用）
- UXが著しく悪化する
- 実装コストも低い

**変更後:**
```
フィード追加・削除: Web ✅ → Mobile ✅
OPMLインポート/エクスポート: Web ✅ → Mobile ❌（ファイル選択UIが複雑）
```

---

## 7. モバイルアプリのアーキテクチャ

### Web vs Mobile の根本的な違い

**Webアプリ（個別デプロイ型）:**
```
各ユーザーが自分のCloudflare Pagesにデプロイ
  ↓
Firebase Client SDK直接使用（認証・Firestore）
  ↓
自分のFirebase/Cloudflareにアクセス
```

**モバイルアプリ（共通アプリ型）:**
```
App Store/Google Playから共通アプリをダウンロード（全ユーザー共通）
  ↓
初期設定でPages Functions URL入力（例: https://feedown-alice.pages.dev）
  ↓
Pages Functions API経由でのみアクセス（Firebase Client SDK不要）
  ↓
各ユーザーのFirebase/Cloudflareにアクセス
```

### モバイルアプリの技術構成

**必要なもの:**
- AsyncStorage（Pages Functions URLの保存のみ）
- API Client（`packages/shared/api`）
- Pages Functions APIへのHTTPリクエスト

**不要なもの:**
- ❌ Firebase Client SDK（firebase パッケージ）
- ❌ Firebase設定（.env内のFirebase認証情報）
- ❌ Firestore直接アクセス

### 認証フロー

**Web:**
```typescript
// Firebase Auth SDK直接使用
import { signInWithEmailAndPassword } from 'firebase/auth';
const userCredential = await signInWithEmailAndPassword(auth, email, password);
const token = await userCredential.user.getIdToken();
```

**Mobile:**
```typescript
// Pages Functions API経由
const response = await apiClient.post('/api/auth/login', { email, password });
const { token, user } = response.data;
// トークンをAsyncStorageに保存
```

### データアクセスフロー

**Web:**
```
Web UI → Firebase Client SDK → Firebase Auth/Firestore
```

**Mobile:**
```
Mobile UI → Pages Functions API → Firebase Admin SDK → Firebase Auth/Firestore
```

### 環境変数の違い

**Web (.env):**
```env
VITE_FIREBASE_API_KEY=...         # 必要
VITE_FIREBASE_AUTH_DOMAIN=...     # 必要
VITE_FIREBASE_PROJECT_ID=...      # 必要
VITE_WORKER_URL=...               # 必要
VITE_API_BASE_URL=...             # 不要（同一オリジン）
```

**Mobile (.env or config):**
```env
# Firebase設定は不要（全て削除）
# Pages Functions URLはユーザーが初期設定で入力（AsyncStorage保存）
APP_NAME=FeedOwn
APP_VERSION=1.0.0
```

---

## 8. パフォーマンス最適化

### 記事一覧取得の工夫
```typescript
// Firestore クエリ
articles
  .where('expiresAt', '>', now)  // 有効期限内のみ
  .orderBy('publishedAt', 'desc')
  .limit(50)  // ページネーション
```

### 既読マークの楽観的UI更新
```typescript
// クライアント側で即座に反映
setReadArticles(prev => [...prev, articleId]);

// バックグラウンドでAPI呼び出し
fetch('/api/articles/:id/read', { method: 'POST' }).catch(() => {
  // 失敗時はロールバック
  setReadArticles(prev => prev.filter(id => id !== articleId));
});
```

---

## 9. セキュリティ設計

### Firebase Security Rules
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

### Pages Functions 認証
```typescript
// すべてのAPI呼び出しでトークン検証
const idToken = request.headers.get('Authorization')?.replace('Bearer ', '');
const decodedToken = await admin.auth().verifyIdToken(idToken);
const userId = decodedToken.uid;
```

---

## 10. デプロイフロー

### 初期セットアップ
```bash
# 1. Firebase プロジェクト作成
firebase init

# 2. Cloudflare Workers デプロイ
cd workers && npx wrangler deploy

# 3. Cloudflare Pages デプロイ（GitHub連携）
# functions/ も自動デプロイされる

# 4. 環境変数設定
# Pages: FIREBASE_API_KEY など
# Workers: FIREBASE_PROJECT_ID など
```

---

## 11. コスト試算（無料枠での運用）

### ユーザー1人あたり/日
- 100フィード × 2回更新 = 200 Worker requests
- 平均10記事/フィード = 1000 Firestore writes
- 記事閲覧 50記事 = 50 Firestore reads
- KV reads = 200回

### 無料枠での上限
- Workers: 10万req/日 → 約500ユーザー
- Firestore writes: 2万/日 → 約20ユーザー ⚠️
- Firestore reads: 5万/日 → 約1000ユーザー

**結論: Firestore writesがボトルネック**

### 対策
1. 更新頻度を6時間に1回に制限（実装済み）
2. 記事の重複チェック（既存記事は更新しない）
3. 差分更新（変更があった記事のみ書き込み）

---

## まとめ

この設計により:
- ✅ シンプルで理解しやすい構成
- ✅ 無料枠で運用可能（小規模）
- ✅ WebとMobileのロジック共有
- ✅ オフライン閲覧対応
- ✅ セキュアなマルチテナント設計

実装の優先順位:
1. Workers (RSS取得プロキシ) - 最小限
2. Pages Functions (API) - コア機能
3. Web UI - MVP
4. packages/shared - API client
5. Mobile - Webの後
