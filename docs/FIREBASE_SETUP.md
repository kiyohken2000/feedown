# Firebase セットアップガイド

FeedOwnで使用するFirebaseプロジェクトのセットアップ手順です。

## 前提条件

- Googleアカウント
- Firebase Console へのアクセス権限

## ステップ 1: Firebase プロジェクト作成

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. 「プロジェクトを追加」をクリック
3. プロジェクト名を入力（例: `feedown`）
4. Google アナリティクスの設定（任意、スキップ可）
5. 「プロジェクトを作成」をクリック

**✅ チェックポイント**: プロジェクトが作成され、Firebase Consoleのダッシュボードが表示される

## ステップ 2: Web アプリを追加

1. プロジェクトダッシュボードで「</> Web」アイコンをクリック
2. アプリのニックネーム入力（例: `feedown-web`）
3. 「Firebase Hosting も設定する」は **チェックしない**
4. 「アプリを登録」をクリック
5. Firebase SDK の設定情報が表示される

**重要**: この画面の設定情報は後で使用するので、**コピーして保存**してください：

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "feedown-xxxxx.firebaseapp.com",
  projectId: "feedown-xxxxx",
  storageBucket: "feedown-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef..."
};
```

**✅ チェックポイント**: Firebase設定情報を取得・保存した

## ステップ 3: Authentication 設定

1. 左メニューから「Authentication」をクリック
2. 「始める」をクリック（初回のみ）
3. 「Sign-in method」タブを選択
4. 「メール/パスワード」をクリック
5. 「有効にする」をオンに切り替え
6. 「保存」をクリック

**✅ チェックポイント**: メール/パスワード認証が有効になっている

## ステップ 4: Firestore Database 作成

1. 左メニューから「Firestore Database」をクリック
2. 「データベースの作成」をクリック
3. ロケーションを選択（例: `asia-northeast1` - 東京）
4. **「本番環境モードで開始」** を選択
   - 注意: テストモードは選択しない（後で Security Rules を設定）
5. 「作成」をクリック

**✅ チェックポイント**: Firestore Databaseが作成され、空のデータベース画面が表示される

## ステップ 5: Firestore Security Rules 設定

1. Firestore Database 画面で「ルール」タブをクリック
2. 以下のルールを貼り付け：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ユーザー認証が必要
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. 「公開」をクリック

**説明**:
- 各ユーザーは自分のデータ（`/users/{userId}/`）のみアクセス可能
- 未認証ユーザーはアクセスできない

**✅ チェックポイント**: Security Rulesが公開された

## ステップ 6: Service Account 作成（Admin SDK用）

1. Firebase Console左上の⚙️（設定）→「プロジェクトの設定」
2. 「サービス アカウント」タブを選択
3. 「新しい秘密鍵の生成」をクリック
4. 「キーを生成」をクリック
5. JSONファイルがダウンロードされる

**重要**: このJSONファイルは **秘密情報** です。安全に保管し、gitにコミットしないでください。

JSONファイルの中身（例）:
```json
{
  "type": "service_account",
  "project_id": "feedown-xxxxx",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@feedown-xxxxx.iam.gserviceaccount.com",
  ...
}
```

**必要な情報**:
- `project_id`
- `private_key`
- `client_email`

**✅ チェックポイント**: サービスアカウントのJSONファイルをダウンロードした

## ステップ 7: 環境変数設定

### 7-1. `.env.shared` 更新

プロジェクトルートの `.env.shared` を以下のように更新：

```env
# Firebase Configuration (Step 2で取得)
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=feedown-xxxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=feedown-xxxxx
VITE_FIREBASE_STORAGE_BUCKET=feedown-xxxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef...

# Cloudflare Workers URL (既に設定済み)
VITE_WORKER_URL=https://feedown-worker.votepurchase.workers.dev

# App Configuration
VITE_APP_NAME=FeedOwn
VITE_APP_VERSION=1.0.0
VITE_API_BASE_URL=
```

### 7-2. 環境変数を同期

```bash
yarn sync-envs
```

### 7-3. Cloudflare Pages Functions 用の環境変数

**後でCloudflare Pagesデプロイ時に設定**（Phase 6で実施）

必要な環境変数:
- `FIREBASE_PROJECT_ID` (Step 6のJSONファイルから)
- `FIREBASE_CLIENT_EMAIL` (Step 6のJSONファイルから)
- `FIREBASE_PRIVATE_KEY` (Step 6のJSONファイルから)

**✅ チェックポイント**: `.env.shared`を更新し、同期した

## ステップ 8: workers/wrangler.toml 更新

`workers/wrangler.toml` のFIREBASE_PROJECT_IDを更新：

```toml
[vars]
FIREBASE_PROJECT_ID = "feedown-xxxxx" # 実際のproject_idに更新
```

再デプロイ:
```bash
cd workers
yarn deploy
```

**✅ チェックポイント**: WorkersのFIREBASE_PROJECT_IDを更新してデプロイした

## 完了確認

すべて完了したら、以下を確認してください：

- [ ] Firebase プロジェクトが作成されている
- [ ] Webアプリが登録され、設定情報を取得した
- [ ] Authentication（メール/パスワード）が有効
- [ ] Firestore Databaseが作成されている
- [ ] Security Rulesが設定されている
- [ ] Service Account（Admin SDK用）のJSONファイルを取得した
- [ ] `.env.shared`にFirebase設定を追加した
- [ ] `yarn sync-envs`を実行した
- [ ] `workers/wrangler.toml`のFIREBASE_PROJECT_IDを更新した

## トラブルシューティング

### エラー: "Firebase: Error (auth/invalid-api-key)"
→ `VITE_FIREBASE_API_KEY`が間違っている可能性があります。Firebase Consoleで確認してください。

### エラー: "Missing or insufficient permissions"
→ Security Rulesが正しく設定されていない可能性があります。Step 5を再確認してください。

### Service Accountのダウンロードができない
→ プロジェクトのオーナー権限が必要です。権限を確認してください。

## 次のステップ

Firebase セットアップが完了したら、Phase 4（Pages Functions API実装）に進みます。
