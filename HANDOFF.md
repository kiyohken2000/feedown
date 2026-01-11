# 引継ぎメモ - FeedOwn Pages Functions デプロイ

## 作業状況

### 完了したこと

1. **Firebase Admin SDK → REST API への書き換え完了**
   - Cloudflare Workers環境でfirebase-adminパッケージが動作しない問題を解決
   - Firebase REST APIを使用する新しいライブラリを作成: `functions/lib/firebase-rest.ts`
   - 認証ヘルパーを更新: `functions/lib/auth.ts`
   - 全8個のAPIエンドポイントを書き換え完了:
     - `api/auth/register.ts` ✓
     - `api/auth/login.ts` ✓
     - `api/feeds/index.ts` (GET, POST) ✓
     - `api/feeds/[id].ts` (DELETE) ✓
     - `api/articles/index.ts` (GET) ✓
     - `api/articles/[id]/read.ts` (POST) ✓
     - `api/articles/[id]/favorite.ts` (POST, DELETE) ✓
     - `api/refresh.ts` (POST) ✓

2. **既存のデプロイ状況**
   - Workers: `https://feedown-worker.votepurchase.workers.dev` (デプロイ済み)
   - Pages静的ファイル: `https://2b2ee2d7.feedown.pages.dev` (デプロイ済み)
   - Pages Functions: 未デプロイ

## 次にやること

### 1. Pages Functionsの環境変数設定

Cloudflare Pagesダッシュボードで以下の環境変数を設定してください:

**必須の環境変数:**
```
FIREBASE_API_KEY=<Firebaseプロジェクトの Web API Key>
FIREBASE_PROJECT_ID=feedown-e78c4
FIREBASE_AUTH_DOMAIN=feedown-e78c4.firebaseapp.com
WORKER_URL=https://feedown-worker.votepurchase.workers.dev
```

**環境変数の取得方法:**
1. Firebase Console → Project Settings → General
2. "Your apps" セクションでWebアプリを選択
3. `apiKey` をコピーして `FIREBASE_API_KEY` に設定

### 2. TypeScriptコンパイルの確認

デプロイ前に、TypeScriptがエラーなくコンパイルできることを確認:

```bash
cd functions
npm run build
# または
npx tsc --noEmit
```

**注意:** 古い`lib/firebase.ts`がまだ存在している場合、import エラーが出る可能性があります。
- `lib/firebase.ts` は削除またはリネーム（`.backup`等）してください
- 新しいREST API版は `lib/firebase-rest.ts` です

### 3. Webアプリの再ビルド

functionsディレクトリをコピーしてからビルド:

```bash
cd /c/Users/all/develop/expo/feedown
yarn workspace @feedown/web build
cp -r functions apps/web/dist/_functions
```

### 4. Pagesへのデプロイ

wrangler.tomlに `pages_build_output_dir` が設定済みなので、以下のコマンドでデプロイ:

```bash
cd /c/Users/all/develop/expo/feedown
yarn wrangler pages deploy --commit-dirty=true
```

**期待される結果:**
- エラーなくデプロイ完了
- Pages Functions (8個のAPIエンドポイント) がデプロイされる
- デプロイ後のURLが表示される (例: `https://xxxxx.feedown.pages.dev`)

### 5. APIエンドポイントのテスト

デプロイしたURLの `/api-test.html` にアクセスしてテスト:

```
https://xxxxx.feedown.pages.dev/api-test.html
```

**テスト手順:**
1. **Register New User**: 新規ユーザーを登録
   - Email: `test@example.com`
   - Password: `password123`
   - トークンが返ってくることを確認
2. **Login**: 返ってきたトークンでログイン確認
3. **Add Feed**: RSSフィードを追加
4. **Get Feeds**: フィード一覧を取得
5. **Refresh Feeds**: フィードを更新
6. **Get Articles**: 記事一覧を取得

各APIが正常に動作すれば、Phase 4完了です。

## 既知の制限事項

1. **XMLパーサー未実装**
   - `functions/api/refresh.ts` の `parseRssXml()` はモック実装
   - 実際にRSSを取得しても記事は保存されない
   - 本番実装にはWorkers互換のXMLパーサーが必要

2. **OPML機能未実装**
   - Phase 5の機能
   - `/api/opml/import` と `/api/opml/export` は未作成

3. **クエリの制限**
   - Firebase REST APIは複雑なクエリ（orderBy, whereの組み合わせ）に制限がある
   - `articles/index.ts` では全記事を取得してクライアント側でフィルタリング
   - パフォーマンス最適化が必要な場合は別途対応

## トラブルシューティング

### デプロイ時に "Could not resolve" エラーが出る場合

**原因:** firebase-adminなど、Node.js組み込みモジュールを使うパッケージが残っている

**解決策:**
1. `functions/lib/firebase.ts` を削除
2. すべてのエンドポイントが `firebase-rest.ts` をインポートしていることを確認
3. `functions/package.json` から不要な依存関係を削除:
   ```bash
   cd functions
   npm uninstall firebase-admin
   ```

### API呼び出しで401 Unauthorized が返る場合

**原因:** 環境変数 `FIREBASE_API_KEY` が未設定

**解決策:**
1. Cloudflare Pagesダッシュボード → Settings → Environment variables
2. Production環境に `FIREBASE_API_KEY` を追加
3. 再デプロイ

### Firebase認証エラーが出る場合

**原因:** Firebase API Key が間違っているか、Firebaseプロジェクトの設定が不正

**確認事項:**
- Firebase Consoleで正しいAPI Keyを取得しているか
- FirebaseプロジェクトIDが `feedown-e78c4` で正しいか
- Firestore Security Rulesがデプロイされているか (`firebase deploy --only firestore:rules`)

## 参考ファイル

- **API仕様書**: `functions/API_VALIDATION_REPORT.md`
- **Phase 4サマリー**: `functions/PHASE4_SUMMARY.md`
- **デプロイチェックリスト**: `functions/DEPLOYMENT_CHECKLIST.md`
- **設計書**: `DESIGN.md` (Section 7にモバイルアーキテクチャ追加済み)
- **進捗管理**: `PROGRESS.md` (Phase 4を完了にマーク予定)

## 連絡先・質問

不明点があれば以下を確認:
1. Cloudflare Workers/Pages ドキュメント: https://developers.cloudflare.com/pages/
2. Firebase REST API ドキュメント: https://firebase.google.com/docs/reference/rest
3. プロジェクトのGitHub Issues (ある場合)

---

**最終更新**: 2026-01-11
**担当者**: Claude (AI Assistant)
**次の担当者へ**: 環境変数設定 → デプロイ → テスト の順で進めてください
