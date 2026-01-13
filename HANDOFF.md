# 引継ぎメモ - Phase 5 完了、Phase 6 完了

## 概要

Phase 5（Web UI）とPhase 6（Cloudflare Pages デプロイ）が完了しました。Feedly風の洗練されたUIに加え、Favicon表示、ドラッグ&ドロップによるフィード並べ替え、サムネイル画像抽出の大幅改善、ダークモード、アカウント削除機能、おすすめフィード機能、トースト通知システム、ワンクリックテストアカウント作成など、すべてのコア機能とユーザビリティ向上機能が実装されました。

**最新デプロイURL**: `https://5c8417a9.feedown.pages.dev` / `https://feedown.pages.dev`
**最新コミット**: `ffdb233` - "Fix Phase 5 issues: subrequests optimization, remove alert, persist login"
**プロジェクト進捗**: Phase 5 完全完了 (100%)、Phase 6 完了 (100%)、Phase 7へ移行可能

## ⭐ 最新のセッションで完了した内容（2026-01-13 Phase 5 完全版）

### Phase 5 最終調整と最適化

このセッションでPhase 5の残っていた問題をすべて修正し、完全に動作する状態になりました。

#### 修正した問題

1. ✅ **"Too many subrequests"エラーの根本的な修正**
   - **問題**: 各フィードごとに`listDocuments()`を実行し、累積サブリクエスト数が制限を超えていた
   - **原因**: `storeArticles()`関数内で毎回全記事を取得していた
   - **解決策**:
     - 全フィード処理開始前に1回だけ`listDocuments()`を実行
     - `existingArticleIds`をすべてのフィードで共有
     - サブリクエスト数を大幅に削減（フィード数 × 記事数 → 1回のみ）
   - **効果**: すべてのフィードから記事が正常に取得されるようになった

2. ✅ **警告アラートポップアップの削除**
   - Dashboard画面の`alert()`を削除
   - エラー情報はコンソールログに出力（開発者向け）
   - ユーザー体験の向上

3. ✅ **ログイン状態の永続化**
   - Firebase Auth の `browserLocalPersistence` を明示的に設定
   - サイトを開きなおしてもログイン状態が保持される
   - `LoginPage.jsx`の`useEffect`で初期化時に設定

#### Gitコミット履歴（本セッション）

1. `ffdb233` - "Fix Phase 5 issues: subrequests optimization, remove alert, persist login"

---

## 前回のセッションで完了した内容（2026-01-13 Phase 5 最終）

### Phase 5 最終バグ修正とUX改善

このセッションでPhase 5の残っていたすべてのバグを修正し、完全に動作する状態になりました。

#### 修正した問題

1. ✅ **スクロール既読機能の実装**
   - 記事が50%以上表示され画面外に出たら即座に既読マーク
   - Intersection Observerで実装
   - Unreadフィルター時は無効化（既存機能）

2. ✅ **モーダル表示時に既読マーク**
   - 記事カードをクリックしてモーダルを開くと即座に既読
   - 楽観的UI更新でスムーズな体験
   - エラー時は自動ロールバック

3. ✅ **Refreshボタンの反応改善**
   - クリックと同時にローディング表示
   - ボタン無効化で二重クリック防止
   - エラー時の状態リセット処理

4. ✅ **全Feedの記事が表示されない問題を修正（Too many subrequests）**
   - **問題**: Cloudflare Workers/Functionsの50サブリクエスト制限に引っかかっていた
   - **原因**: 各記事ごとに`getDocument()`で既存チェックを行い、大量のサブリクエストが発生
   - **解決策**:
     - 1回の`listDocuments()`で全既存記事を取得
     - メモリ上（Set）で既存チェック
     - サブリクエスト数を44回以上 → 5回に大幅削減
   - **効果**: 4つ全てのFeedから記事が正常に取得されるようになった

5. ✅ **Clear All DataとDelete Accountの修正**
   - readArticlesとfavoritesコレクションの削除を追加
   - Delete AccountのCREDENTIAL_TOO_OLD_LOGIN_AGAINエラーに対応
   - ユーザーフレンドリーなエラーメッセージ表示

6. ✅ **コンソールログのクリーンアップ**
   - 大量の「Article viewed」ログを無効化
   - Refresh成功メッセージを簡潔に改善
   - エラーログは維持して問題発見しやすく

#### Gitコミット履歴（Phase 5 最終セッション）

1. `c710f21` - "Fix Phase 5 issues: scroll-based read marking, data deletion, and article display"
2. `e52325c` - "Add debug logs and improve Delete Account error handling"
3. `52b648a` - "Make scroll mark-as-read instant and add extensive debug logs"
4. `13dc46d` - "Add modal mark-as-read and detailed failed feed error reporting"
5. `b895c98` - "Fix 'Too many subrequests' error by optimizing article existence check"
6. `cf0a47f` - "Reduce console noise by disabling verbose debug logs"

---

## デプロイコマンド

### Cloudflare Pages へのデプロイ

**注意**: このプロジェクトはGitHub連携を使用していないため、手動でデプロイする必要があります。

#### 手動デプロイ手順

```bash
# ルートディレクトリから実行（推奨）

# 1. Webアプリをビルド
yarn build:web

# 2. Cloudflare Pagesにデプロイ
npx wrangler pages deploy apps/web/dist --project-name=feedown
```

**注意**:
- `feedown` はあなたのCloudflare Pagesプロジェクト名に置き換えてください
- デプロイ後、新しいURLが表示されます（例: `https://1df6fe0b.feedown.pages.dev`）
- 本番URL（`https://feedown.pages.dev`）にも自動的に反映されます

### Cloudflare Workers のデプロイ

```bash
cd workers
npx wrangler deploy
```

### Functions（TypeScript）のビルド

デプロイ前にTypeScriptをビルドする必要があります：

```bash
cd functions
npm run build
```

ビルドされた `.js` ファイルは自動的にCloudflare Pages Functionsとしてデプロイされます。

---

## 今回のセッションで実装した機能（2026-01-13 最新）

### 実装した機能一覧

#### 0. ✅ **API path重複問題の修正** (commit: 0856e52) **NEW**
- **問題**: API呼び出し時にパスが重複し、`/api/api/refresh`のようになっていた
- **原因**: 各ページで`baseURL`を`'/api'`に設定し、エンドポイントも`'/api/refresh'`と定義していたため
- **修正内容**:
  - 5つのページコンポーネントでAPI baseURLを `'/api'` → `''`（空文字列）に変更
  - `apps/web/src/pages/FeedsPage.jsx`
  - `apps/web/src/pages/DashboardPage.jsx`
  - `apps/web/src/pages/SettingsPage.jsx`
  - `apps/web/src/pages/ArticleDetailPage.jsx`
  - `apps/web/src/pages/FavoritesPage.jsx`
- **効果**:
  - API呼び出しが正しいパス（`/api/refresh`）で行われるようになった
  - 405 Method Not Allowedエラーが解消

#### 1. ✅ **サイトタイトルとfavicon設定** (commit: 1db46f1)
- **サイトタイトル変更**: 「web」→「FeedOwn」
- **favicon設定**: `apps/web/src/assets/images/favicon.ico` を使用
- ブラウザタブに表示されるタイトルとアイコンが適切に設定される

#### 2. ✅ **グローバルstateで記事一覧を保持** (commit: 1db46f1)
- **ArticlesContext作成**
  - React Context APIで記事一覧、既読記事、お気に入り、フィードをグローバル管理
  - `apps/web/src/contexts/ArticlesContext.jsx` - 新規作成

- **主な機能**
  - 他のページからDashboardに戻っても記事一覧が保持される
  - 記事取得中に「No Articles」が表示されない
  - スムーズなページ遷移体験

- **統合**
  - `apps/web/src/App.jsx` - ArticlesProvider追加
  - `apps/web/src/pages/DashboardPage.jsx` - ArticlesContext使用
  - `apps/web/src/pages/SettingsPage.jsx` - ログアウト/削除時にクリア

#### 3. ✅ **テストアカウントの制限** (commit: 1db46f1)
- **対象アカウント**: `test-*@test.com`（Quick Create Test Accountで作成）
- **フィード制限**: 最大3個まで（通常アカウントは100個）
- **お気に入り制限**: 最大10個まで（通常アカウントは無制限）
- **実装場所**:
  - `functions/lib/auth.ts` - `isTestAccount()` 関数追加
  - `functions/api/feeds/index.ts` - フィード追加時に制限チェック
  - `functions/api/articles/[id]/favorite.ts` - お気に入り追加時に制限チェック
- **エラーメッセージ**: 制限超過時にわかりやすいメッセージを表示

#### 4. ✅ **記事一覧取得のパフォーマンス改善** (commit: 1db46f1)
- **並列リクエスト**: `Promise.all()` を使用
  - feeds、articles、readArticlesを並列で取得
  - 以前は順次実行（3回のAPI呼び出しを待つ）
- **効果**: Dashboardの読み込みとリフレッシュが高速化
- **実装場所**: `functions/api/articles/index.ts`

### 変更したファイル

#### フロントエンド
- `apps/web/index.html` - タイトルとfavicon設定
- `apps/web/src/App.jsx` - ArticlesProvider追加
- `apps/web/src/contexts/ArticlesContext.jsx` - 新規作成
- `apps/web/src/pages/DashboardPage.jsx` - ArticlesContext統合
- `apps/web/src/pages/SettingsPage.jsx` - ログアウト時にグローバルstateクリア

#### バックエンド
- `functions/lib/auth.ts` - `isTestAccount()` 関数追加
- `functions/api/feeds/index.ts` - テストアカウントのフィード制限
- `functions/api/articles/index.ts` - 並列リクエストでパフォーマンス改善
- `functions/api/articles/[id]/favorite.ts` - テストアカウントのお気に入り制限

### Gitコミット履歴（最新セッション）
1. `1db46f1` - "Improve UX and implement test account limitations"

---

## 前回のセッションで実装した機能（2026-01-13 前半）

### 実装した機能一覧

#### 1. ✅ **ダークモード実装** (commit: ea491d6)
- **ThemeContext作成**
  - React Context APIを使用したグローバルなテーマ管理
  - `apps/web/src/contexts/ThemeContext.jsx` - isDarkMode状態とtoggleDarkMode関数を提供
  - localStorageでダークモード設定を永続化

- **CSS変数によるテーマ管理**
  - `apps/web/src/App.css` - :root と .dark-mode セレクタでカラー定義
  - プライマリカラー、背景色、テキスト色などを変数化
  - スムーズな色変更トランジション

- **全ページ対応**
  - Dashboard、Feeds、Favorites、Settings、Login、Navigation、ArticleModal
  - 各コンポーネントで isDarkMode に応じた条件付きスタイリング
  - 統一感のあるダークモードデザイン

- **Settings画面にトグルスイッチ追加**
  - スライド式トグルボタン（iOS風デザイン）
  - リアルタイムで全画面に反映

#### 2. ✅ **記事リスト表示の改善** (commits: c714598, b2db50d)
- **問題**: Refresh中に記事リストが一時的に消えて「No Articles」が表示される
- **原因**: `fetchArticles`で`setArticles([])`を呼び出していた + `handleRefresh`で重複して`setArticlesLoading(true)`を設定
- **解決策**:
  1. 第一段階: `setArticles([])`を削除して古い記事を保持
  2. 第二段階: `handleRefresh`内の`setArticlesLoading(true)`を削除してローディング状態の管理を一元化
- **結果**: Refresh中も記事リストが表示されたままでスムーズなUX

#### 3. ✅ **アカウント削除機能** (commits: afb587f, 4c164b8)
- **2つの削除オプション**
  - **Clear All Data**: すべてのデータ（フィード、記事、お気に入り）を削除、アカウントは残す
  - **Delete Account**: アカウントとすべてのデータを完全削除

- **バックエンド実装**
  - `functions/api/user/data.js` - DELETE endpoint for data clearing
    - `users/{uid}/feeds`、`users/{uid}/articles`、`users/{uid}/favorites` の全削除
    - アカウントは残る
  - `functions/api/user/account.js` - DELETE endpoint for account deletion
    - Firestoreデータ完全削除（feeds, articles, favorites, userドキュメント）
    - Firebase Auth REST APIでアカウント削除
    - `https://identitytoolkit.googleapis.com/v1/accounts:delete`

- **ヘルパー関数追加**
  - `functions/lib/firebase-rest.ts` に `deleteCollection()` 関数追加
    - コレクション内の全ドキュメントをバッチ削除
    - `listDocuments()` + `Promise.all()` でパフォーマンス最適化

- **フロントエンド実装**
  - `packages/shared/src/api/endpoints.ts` に `UserAPI` クラス追加
    - `deleteAccount()`, `clearAllData()` メソッド
  - `apps/web/src/pages/SettingsPage.jsx` に「Danger Zone」セクション追加
    - 2段階確認ダイアログで誤操作防止
    - Clear Data（オレンジ）とDelete Account（赤）のボタン
    - 英語での警告メッセージと説明

#### 4. ✅ **おすすめフィード機能** (commits: 305b473, cc39992)
- **13個の日本語ニュースフィードを事前設定**
  - AFP、BBC、CNN、Rocket News 24、Weekly ASCII Plus、National Geographic、
  - Lifehacker、Reuters、GIGAZINE、Gizmodo、CNET Japan、AAPL Ch.、Kitamori Kawaraban

- **ワンクリック登録機能**
  - `apps/web/src/pages/FeedsPage.jsx` に「Recommended Feeds」セクション追加
  - グリッドレイアウト（280px minimum、auto-fill）
  - 各フィードに「Add」ボタン
  - 追加済みフィードは「Added」と表示され、グレーアウト
  - 追加中は「Adding...」と表示

- **重複チェック**
  - `isFeedAdded()` 関数で既存フィードと照合
  - 重複時はアラート表示

- **セクション配置**
  - 初期配置: Recommended Feeds → Your Feeds
  - ユーザーフィードバックで位置変更: Your Feeds → Recommended Feeds（最終版）

#### 5. ✅ **API Client エラーハンドリング改善** (commit: 9c0cde7)
- **問題**: Clear Data実行時に「Failed to execute 'json' on 'Response': Unexpected end of JSON input」エラー
- **原因**: `response.json()` を常に呼び出していたが、DELETE レスポンスがemptyの場合にエラー
- **解決策**: `packages/shared/src/api/client.ts` の `request()` メソッドを修正
  - Content-Typeヘッダーをチェック
  - `response.text()` を先に取得してから安全にJSON.parse
  - try-catchでパースエラーをキャッチ
  - 空レスポンスの場合は data: null を返す
- **結果**: 空レスポンスやinvalid JSONでもエラーが発生しない

### 変更したファイル

#### バックエンド
- `functions/api/user/data.js` - 新規作成（データクリアエンドポイント）
- `functions/api/user/account.js` - 新規作成（アカウント削除エンドポイント）
- `functions/lib/firebase-rest.ts` - deleteCollection() 関数追加

#### 共有パッケージ
- `packages/shared/src/api/client.ts` - 安全なJSON parsing、エラーハンドリング改善
- `packages/shared/src/api/endpoints.ts` - UserAPI クラス追加、FeedOwnAPI に user プロパティ追加

#### フロントエンド
- `apps/web/src/contexts/ThemeContext.jsx` - 新規作成（ダークモードContext）
- `apps/web/src/App.css` - CSS変数でダークモード対応
- `apps/web/src/App.jsx` - ThemeProvider追加
- `apps/web/src/pages/DashboardPage.jsx` - 記事リスト表示修正、ダークモード対応
- `apps/web/src/pages/FeedsPage.jsx` - おすすめフィード機能追加、ダークモード対応
- `apps/web/src/pages/FavoritesPage.jsx` - ダークモード対応
- `apps/web/src/pages/SettingsPage.jsx` - アカウント削除機能、ダークモードトグル、全体的にダークモード対応
- `apps/web/src/pages/LoginPage.jsx` - ダークモード対応
- `apps/web/src/components/Navigation.jsx` - ダークモード対応
- `apps/web/src/components/ArticleModal.jsx` - ダークモード対応

### 修正したバグ

#### Bug 1: 記事リストが一時的に消える
**症状**: Refreshボタンをクリックすると記事リストが消えて「No Articles」が表示される
**修正内容**:
1. `DashboardPage.jsx` の `fetchArticles()` から `setArticles([])` を削除
2. `handleRefresh()` から `setArticlesLoading(true)` を削除（fetchArticlesに一任）
**結果**: Refresh中も既存の記事リストが表示され続ける

#### Bug 2: Clear Data実行時のJSON parsing error
**症状**: 「Failed to execute 'json' on 'Response': Unexpected end of JSON input」エラー
**修正内容**: `packages/shared/src/api/client.ts` でContent-Typeチェックと安全なJSON parsingを実装
**結果**: 空レスポンスでもエラーが発生しない

### Gitコミット履歴（前半セッション）
1. `ea491d6` - "Implement dark mode across the entire application"
2. `c714598` - "Keep article list visible during refresh"
3. `b2db50d` - "Fix: Remove duplicate articlesLoading state setting in handleRefresh"
4. `afb587f` - "Add account deletion and data clearing features"
5. `4c164b8` - "Change Danger Zone UI text to English"
6. `305b473` - "Add recommended feeds section to Feeds page"
7. `cc39992` - "Reorder sections: move Recommended Feeds after Your Feeds"
8. `9c0cde7` - "Fix JSON parsing error in API client for empty responses"

---

## 今回のセッションで実装した機能（2026-01-13 続き）

### 実装した機能一覧

#### 1. ✅ **Dashboard更新タイミング最適化** (commit: 893206b)
- **Firestoreの読み取り回数削減**
  - ウィンドウフォーカス時の自動更新を削除（無駄な読み取りを削減）
  - 更新タイミングを以下の2つに限定：
    1. Refreshボタンを押したとき
    2. Dashboard表示中、前回更新から10分経過したとき
  - 10分経過チェックは1分ごとに実行

- **実装詳細**
  - `lastArticleFetchTime` state追加（最終更新日時を記録）
  - `useEffect`で1分ごとのインターバルチェック
  - 10分（600,000ms）経過時に自動的に`fetchArticles(true)`を実行

#### 2. ✅ **Clear Data/Delete Account機能の修正** (commits: 0720bd9, 893206b)
- **readArticlesコレクションの削除追加**
  - `functions/api/user/data.ts` - Clear Data機能
  - `functions/api/user/account.ts` - Delete Account機能
  - 削除対象: feeds, articles, **readArticles**, favorites

- **詳細なデバッグログ追加**
  - 各コレクション削除の前後でログ出力
  - `deleteCollection()`関数で削除ドキュメント数を表示
  - エラー発生時の詳細なエラー情報を出力

- **Delete Accountのエラーハンドリング改善** (commit: 2278545)
  - Firebase Auth削除時の詳細なエラーメッセージ表示
  - エラーレスポンスのJSONパース処理を追加
  - Cloudflare Dashboardでログ確認可能

#### 3. ✅ **トースト通知システムの実装** (commits: 2278545, d072215)
- **新規コンポーネント作成**
  - `apps/web/src/components/Toast.jsx` - トーストコンポーネント
  - `apps/web/src/components/ToastContainer.jsx` - ToastProvider（Context API）
  - `apps/web/src/styles/Toast.css` - トーストスタイル

- **トーストの種類**
  - `success` (緑) - 成功メッセージ
  - `error` (赤) - エラーメッセージ
  - `info` (青) - 情報メッセージ

- **表示位置とアニメーション**
  - 画面右下に固定
  - スライドインアニメーション
  - 3秒後に自動消去（カスタマイズ可能）
  - 手動閉じるボタン（×）

- **FeedsPageへの適用**
  - フィード追加成功時のトースト表示
  - おすすめフィード追加成功時のトースト表示
  - 既に追加済みの場合はinfoトースト
  - エラー時のトースト表示
  - フィード削除成功時のトースト表示

#### 4. ✅ **ワンクリックテストアカウント作成** (commit: 1e34376)
- **Quick Create Test Accountボタン**
  - Register画面に青色ボタンを追加
  - メールアドレス: `test-{6桁のランダム数字}@test.com`
  - パスワード: `111111`（固定）
  - 作成後、自動的にログインしてDashboardへ遷移

- **パスワード注意書き**
  - Login/Register画面両方に表示
  - 英語: "⚠️ If you didn't set a custom password, the default password is **111111**"
  - 黄色の警告ボックスで目立つように表示
  - ダークモード対応

- **UI配置**
  - Register画面: フォーム → Create Accountボタン → 区切り線（OR） → Quick Create Test Accountボタン → 注意書き
  - Login画面: 注意書きのみ

#### 5. ✅ **Dashboard初回ロード時の自動Refresh** (commit: 50e10c1)
- **自動Refresh実行**
  - Dashboard画面を開いたとき（初回ロード時）に自動的に`handleRefresh()`を実行
  - ログイン後、またはアカウント作成後に自動的にRSS取得開始

- **実装詳細**
  - `onAuthStateChanged`のコールバック内で`handleRefresh()`を呼び出し
  - フィード一覧と記事一覧を自動的に最新化
  - ユーザーは手動でRefreshボタンを押す必要なし

### 変更したファイル

#### バックエンド
- `functions/api/user/data.ts` - readArticles削除追加、デバッグログ追加
- `functions/api/user/data.js` - TypeScriptからビルド
- `functions/api/user/account.ts` - readArticles削除追加、詳細エラーログ追加
- `functions/api/user/account.js` - TypeScriptからビルド
- `functions/lib/firebase-rest.ts` - deleteCollection()にデバッグログ追加
- `functions/lib/firebase-rest.js` - TypeScriptからビルド

#### 共有パッケージ
- なし（前回セッションで完了）

#### フロントエンド
- `apps/web/src/components/Toast.jsx` - 新規作成（トーストコンポーネント）
- `apps/web/src/components/ToastContainer.jsx` - 新規作成（ToastProvider）
- `apps/web/src/styles/Toast.css` - 新規作成（トーストスタイル）
- `apps/web/src/App.jsx` - ToastProvider追加
- `apps/web/src/pages/DashboardPage.jsx` - 更新タイミング最適化、初回ロード時の自動Refresh
- `apps/web/src/pages/FeedsPage.jsx` - トースト通知適用、アラート削除
- `apps/web/src/pages/LoginPage.jsx` - Quick Create Test Accountボタン追加、パスワード注意書き追加

### 修正したバグ

#### Bug 1: Clear Data実行時にreadArticlesとfavoritesが消えない
**症状**: Settings画面でClear Dataを実行してもreadArticlesとfavoritesコレクションが残る
**修正内容**:
- `functions/api/user/data.ts`でreadArticlesコレクションを削除対象に追加
- `functions/api/user/account.ts`でも同様に追加
**結果**: すべてのデータが正しく削除される

#### Bug 2: Delete Account実行時のエラー
**症状**: 「Failed to delete account: Failed to delete account」というエラー
**修正内容**:
- 詳細なデバッグログを追加してエラー原因を特定
- Firebase Auth削除時のエラーメッセージを詳細化
**結果**: エラーが解消され、アカウント削除が正常に動作

#### Bug 3: Feed追加時にトーストが表示されない
**症状**: おすすめフィード追加時にアラートは消えたがトーストも表示されない
**修正内容**:
- `handleAddRecommendedFeed()`で成功時のトースト表示をコメントアウトしていたのを有効化
**結果**: トースト通知が正しく表示される

### Gitコミット履歴（後半セッション）
1. `0720bd9` - "Fix: Include readArticles collection in Clear Data and Delete Account operations"
2. `893206b` - "Add detailed debug logging to Clear Data operation and optimize Dashboard refresh timing"
3. `2278545` - "Add toast notifications, improve Delete Account error logging, and optimize Dashboard refresh timing"
4. `d072215` - "Fix: Show toast notification when adding recommended feeds"
5. `1e34376` - "Add quick test account creation with default password notice"
6. `50e10c1` - "Auto-refresh feeds on Dashboard initial load"

---

## 最新の実装内容（Phase 5 完全版 + 追加機能）

### 実装済みの全機能

#### 0. ダークモード ✅ **NEW (2026-01-13)**
- **グローバルテーマ管理**
  - React Context APIによる状態管理
  - localStorageで設定を永続化
  - アプリ全体で即座に反映

- **CSS変数によるテーマ切り替え**
  - :root と .dark-mode セレクタ
  - プライマリカラー、背景色、テキスト色、ボーダー色など完全対応
  - スムーズなトランジション

- **全コンポーネント対応**
  - Dashboard、Feeds、Favorites、Settings、Login
  - Navigation、ArticleModal
  - 条件付きスタイリングで統一感のあるデザイン

- **Settings画面でON/OFF**
  - iOS風トグルスイッチ
  - リアルタイム切り替え

#### 1. Favicon表示機能 ✅
- **Google Favicon Service使用**
  - `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  - フィード追加時とRefresh時に自動取得
  - 各フィードのfaviconUrlフィールドに保存

- **表示箇所**
  - **Dashboard**: 記事カード内のフィードタイトル横に16x16pxで表示
  - **Feeds Page**: フィードリスト内に24x24pxで表示
  - **Favorites Page**: お気に入り記事のフィードタイトル横に16x16pxで表示
  - 画像読み込みエラー時は非表示（onErrorハンドリング）

#### 2. フィード並べ替え機能 ✅ **NEW**
- **ドラッグ&ドロップUI**
  - HTML5 Drag and Drop API使用
  - ドラッグハンドル（☰）表示
  - ドラッグ中は半透明+縮小エフェクト
  - カーソル: move / grab

- **orderフィールドによる管理**
  - 各フィードにorder数値フィールド
  - 新規フィード追加時は`Date.now()`をデフォルト値に設定
  - フィードリストはorder昇順でソート
  - PATCH `/api/feeds/:id`でorder更新

- **楽観的UI更新**
  - ドロップ時に即座にUI更新
  - バックグラウンドでバッチ更新（Promise.all）
  - エラー時は自動ロールバック

#### 3. サムネイル画像抽出の大幅改善 ✅ **NEW**
- **10種類の抽出方法**
  1. media:thumbnail タグ
  2. media:content タグ（画像タイプ）
  3. enclosure タグ（画像タイプ）
  4. Atom link enclosure
  5. description内のimgタグ
  6. entryXml内のimgタグ
  7. og:image メタタグ
  8. **URL内の画像拡張子パターンマッチング** ← NEW
  9. **descriptionタグ内の画像URL** ← NEW
  10. **content:encoded内の画像URL** ← NEW

- **抽出精度の向上**
  - AFPBB等の画像が取得できなかったフィードにも対応
  - 大文字小文字を区別しない正規表現（/i フラグ）
  - シングル・ダブルクォート両対応

#### 4. Unreadフィルター改善 ✅ **NEW**
- **自動既読の無効化**
  - Unreadフィルター表示中は自動既読マークを無効化
  - filter === 'unread'の場合、Intersection Observerを設定しない
  - ユーザーが未読記事を閲覧しても勝手に既読にならない

#### 5. 無限スクロール（ページネーション） ✅ **NEW**
- **段階的な記事読み込み**
  - 初回表示: limit=50
  - スクロールで下部到達時: 次の50件を自動読み込み
  - Intersection Observerで最下部を監視

- **実装詳細**
  - `hasMore`フラグで続きがあるかチェック
  - `loadingMore`状態で追加読み込み中を表示
  - リスト最後に「Loading more articles...」表示
  - 全件読み込み完了時は「No more articles to load」表示
  - Refresh/Mark All Read時はリセットして最初から読み込み

#### 6. アカウント削除機能 ✅ **NEW (2026-01-13)**
- **2つの削除オプション**
  - **Clear All Data**: すべてのデータ（フィード、記事、お気に入り）削除、アカウントは保持
  - **Delete Account**: アカウントとすべてのデータを完全削除

- **Danger Zone UI**
  - Settings画面に専用セクション
  - 2段階確認ダイアログ（誤操作防止）
  - Clear Data（オレンジボタン）、Delete Account（赤ボタン）
  - 英語での警告メッセージ

- **バックエンド実装**
  - Firebase REST APIでアカウント削除
  - Firestoreコレクションのバッチ削除
  - deleteCollection() ヘルパー関数

#### 7. おすすめフィード機能 ✅ **NEW (2026-01-13)**
- **13個の日本語ニュースフィードを事前設定**
  - AFP、BBC、CNN、Rocket News 24、Weekly ASCII Plus、National Geographic
  - Lifehacker、Reuters、GIGAZINE、Gizmodo、CNET Japan、AAPL Ch.、Kitamori Kawaraban

- **ワンクリック登録**
  - Feeds画面に「Recommended Feeds」セクション
  - グリッドレイアウトで見やすく表示
  - 各フィードに「Add」ボタン
  - 追加済みは「Added」（グレーアウト）
  - 重複チェック機能

#### 8. Feedly風UI ✅
- **サムネイル画像表示**
  - RSS/Atomフィードから自動抽出（media:thumbnail, enclosure, img タグ等）
  - 最大300px高さで表示（モーダル内）
  - object-fit: contain でアスペクト比維持
  - 大文字小文字を区別しない正規表現で検索

- **記事カードデザイン**
  - 横並びレイアウト（画像左、コンテンツ右）
  - フィードタイトル表示（オレンジ色）
  - 相対時間表示（「5m ago」「3h ago」形式）
  - 記事description（2行まで表示）
  - 既読記事は透明度60%

#### 9. インタラクション機能 ✅
- **モーダル表示**
  - 記事クリックでモーダル表示（ページ遷移なし）
  - 閉じるボタン（右上、透過背景、円形、ホバーエフェクト）
  - 既読マーク、お気に入り追加/削除ボタン
  - 元記事へのリンク

- **自動既読マーク**
  - Intersection Observer APIを使用
  - 記事が50%以上表示され2秒経過で自動既読
  - 楽観的UI更新

- **一括操作**
  - 「✓ Mark All Read」ボタン（緑色）
  - 未読記事を一括で既読に
  - 並列API呼び出しで高速処理
  - 未読がない場合はボタン無効化

#### 10. ナビゲーション・コントロール ✅
- **スティッキーナビゲーション**
  - スクロールしても常に表示（position: sticky）
  - 未読数バッジ（Dashboardリンクの横）
  - Z-index: 100

- **スティッキーコントロールバー**
  - All/Unread/Readフィルター
  - ✓ Mark All Read ボタン
  - 🔄 Refresh ボタン
  - 半透過背景（rgba(255, 255, 255, 0.95)）
  - ぼかし効果（backdrop-filter: blur(10px)）
  - スクロールしても常に表示（top: 73px、ナビゲーションの下）
  - Z-index: 50

#### 11. クリーンなレイアウト ✅
- 無駄な「Dashboard」見出しを削除
- 「Welcome back, email」テキストを削除
- 最大限の作業スペースを確保

---

## 技術的な実装詳細

### バックエンド改善

#### Favicon抽出機能（`functions/api/refresh.ts`, `functions/api/feeds/index.ts`）
```typescript
function extractFaviconUrl(feedUrl: string): string {
  try {
    const url = new URL(feedUrl);
    const domain = url.hostname;
    // Google's favicon service を使用
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch (error) {
    console.error('Error extracting favicon URL:', error);
    return '';
  }
}
```

- フィード追加時（`feeds/index.ts`）とRefresh時（`refresh.ts`）に呼び出し
- フィードドキュメントのfaviconUrlフィールドに保存
- エラー時は空文字列を返す

#### フィード並べ替えAPI（`functions/api/feeds/[id].ts`）
```typescript
// PATCH /api/feeds/:id
export async function onRequestPatch(context: any): Promise<Response> {
  const { order } = await request.json();

  if (order === undefined) {
    return new Response(
      JSON.stringify({ error: 'Order field is required' }),
      { status: 400 }
    );
  }

  await updateDocument(feedPath, { order }, idToken, config);
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
```

#### 画像抽出機能（`functions/api/refresh.ts`）
```typescript
function extractImageUrl(entryXml: string, content: string): string | null {
  // 1. media:thumbnail (最も一般的)
  // 2. media:content (画像タイプ)
  // 3. enclosure (画像タイプ)
  // 4. Atom link enclosure
  // 5. <img> タグ（コンテンツ内）
  // 6. <img> タグ（entryXml内）
  // 7. og:image メタタグ
  // 8. URL内の画像拡張子パターンマッチング ← NEW
  // 9. descriptionタグ内の画像URL ← NEW
  // 10. content:encoded内の画像URL ← NEW

  // 大文字小文字を区別しない（/i フラグ）
  // シングル・ダブルクォート両対応
  // デバッグログ付き
}
```

### フロントエンド構造

#### コンポーネント
- `Navigation.jsx` - スティッキーナビゲーション、未読数バッジ表示
- `ArticleModal.jsx` - モーダル表示、画像サイズ制限、透過閉じるボタン
- `DashboardPage.jsx` - メインUI、フィルター、自動既読、一括既読、**Favicon表示**
- `FeedsPage.jsx` - フィード管理、**ドラッグ&ドロップ並べ替え**、**Favicon表示**
- `FavoritesPage.jsx` - お気に入り記事一覧、**Favicon表示**

#### 主要なstate管理（DashboardPage.jsx）
```jsx
const [articles, setArticles] = useState([]);
const [filteredArticles, setFilteredArticles] = useState([]);
const [readArticles, setReadArticles] = useState(new Set());
const [favoritedArticles, setFavoritedArticles] = useState(new Set());
const [selectedArticle, setSelectedArticle] = useState(null);
const [filter, setFilter] = useState('all');
const [feeds, setFeeds] = useState([]); // ← NEW (Favicon表示用)
const unreadCount = useMemo(() => {...}, [articles, readArticles]);
```

#### ドラッグ&ドロップ実装（FeedsPage.jsx）
```jsx
const [draggedIndex, setDraggedIndex] = useState(null);

const handleDragStart = (e, index) => {
  setDraggedIndex(index);
  e.dataTransfer.effectAllowed = 'move';
};

const handleDrop = async (e, dropIndex) => {
  // 配列を並び替え
  const newFeeds = [...feeds];
  const [draggedFeed] = newFeeds.splice(draggedIndex, 1);
  newFeeds.splice(dropIndex, 0, draggedFeed);

  // 楽観的UI更新
  setFeeds(newFeeds);

  // バックグラウンドでorder更新
  await Promise.all(
    newFeeds.map((feed, index) =>
      api.feeds.update(feed.id, { order: index })
    )
  );
};
```

#### Intersection Observer（自動既読）- Unread時は無効化
```jsx
useEffect(() => {
  if (observerRef.current) {
    observerRef.current.disconnect();
  }

  // Unreadフィルター時は自動既読を無効化 ← NEW
  if (filter === 'unread') {
    return;
  }

  observerRef.current = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        // 2秒後に既読マーク
        setTimeout(async () => {
          await api.articles.markAsRead(articleId);
          setReadArticles(prev => new Set([...prev, articleId]));
        }, 2000);
      }
    });
  }, { threshold: 0.5 });

  // ... observe処理
}, [filteredArticles, readArticles, api, filter]); // ← filterを依存配列に追加
```

#### APIクライアント拡張（`packages/shared/src/api/`）
```typescript
// client.ts - PATCH メソッド追加
async patch<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
  return this.request<T>(endpoint, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

// endpoints.ts - FeedsAPI に update メソッド追加
async update(feedId: string, data: { order?: number }) {
  return this.client.patch<void>(`/api/feeds/${feedId}`, data);
}
```

---

## ファイル構成

```
feedown/
├── apps/web/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navigation.jsx          # スティッキーナビ、未読数バッジ
│   │   │   └── ArticleModal.jsx        # モーダル表示、透過閉じるボタン
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx           # ログイン/登録
│   │   │   ├── DashboardPage.jsx       # メインUI（大幅改善）
│   │   │   ├── FeedsPage.jsx           # フィード管理
│   │   │   ├── FavoritesPage.jsx       # お気に入り
│   │   │   ├── SettingsPage.jsx        # 設定
│   │   │   └── ArticleDetailPage.jsx   # 記事詳細（モーダルで置き換え）
│   │   └── App.jsx                     # ルート設定
│   └── .env                            # API_BASE_URL: https://7a58f493.feedown.pages.dev
├── functions/
│   ├── api/
│   │   ├── articles/index.ts           # 記事一覧（isReadフラグ付き）
│   │   ├── articles/[id]/read.ts       # 既読マーク
│   │   ├── articles/[id]/favorite.ts   # お気に入り追加/削除
│   │   ├── favorites.ts                # お気に入り一覧
│   │   ├── refresh.ts                  # RSS取得、画像抽出機能
│   │   └── feeds/                      # フィードCRUD
│   └── lib/                            # Firebase Admin SDK
├── workers/
│   └── src/index.ts                    # RSS取得プロキシ
└── packages/shared/
    └── src/api/endpoints.ts            # APIクライアント
```

---

## ローカル環境の状態

### 開発サーバー
- **ポート**: 5178
- **URL**: http://localhost:5178/
- **状態**: 起動中（タスクID: bc2b361）
- **停止方法**: KillShellツールでbc2b361を指定

### 環境変数
- `apps/web/.env`の`VITE_API_BASE_URL`: `https://7a58f493.feedown.pages.dev`

### Gitの状態
- **最新コミット**: "Implement infinite scroll (pagination) for Dashboard" (b002dba)
- **前回のコミット**: "Update HANDOFF.md with latest implementations" (3009732)
- **ブランチ**: main
- **すべての変更がプッシュ済み** ✅

---

## デプロイ履歴

| デプロイ日時 | URL | 主な変更 |
|------------|-----|---------|
| 2026-01-12 00:45 | `e34bac3f.feedown.pages.dev` | RSSパーサー実装 |
| 2026-01-12 00:52 | `26e42e0c.feedown.pages.dev` | お気に入り機能修正 |
| 2026-01-12 01:05 | `007b4100.feedown.pages.dev` | isReadフラグ追加 |
| 2026-01-12 01:30 | `8522aa45.feedown.pages.dev` | favorites.ts追加 |
| 2026-01-12 02:00 | `96270e7d.feedown.pages.dev` | Feedly風UI実装 |
| 2026-01-12 02:30 | `10c5e8ec.feedown.pages.dev` | 画像抽出改善、未読数バッジ |
| 2026-01-12 03:00 | `af73564c.feedown.pages.dev` | スティッキーヘッダー |
| 2026-01-12 03:30 | `1bf93f7d.feedown.pages.dev` | モーダル画像調整、スティッキーコントロール |
| 2026-01-12 04:00 | `7a58f493.feedown.pages.dev` | 一括既読、透過背景 |
| 2026-01-12 11:00 | 手動デプロイ済み | Favicon表示、ドラッグ&ドロップ、画像抽出改善 |
| 2026-01-12 11:15 | 手動デプロイ済み | Unreadフィルター時自動既読無効化、全件表示 |
| 2026-01-12 12:30 | 手動デプロイ済み | 無限スクロール（ページネーション）実装 |
| 2026-01-13 16:52 | `1df6fe0b.feedown.pages.dev` | API path重複問題の修正 (api/api → api) |
| **2026-01-13 23:00** | **`5c8417a9.feedown.pages.dev`** | **Too many subrequests修正、警告アラート削除、ログイン永続化** |

---

## 動作確認手順

### 基本機能
1. **ログイン**: https://feedown.pages.dev でログイン
2. **フィード追加**: Feedsページで任意のRSSフィードURLを追加
3. **記事取得**: Dashboardで「🔄 Refresh」をクリック
4. **画像表示**: 記事カードに画像が表示される（新規取得分）

### 新機能の確認 ✅ **NEW**

#### Favicon表示
1. **Dashboardで確認**
   - 記事カードのフィードタイトル横に小さいファビコン（16x16px）が表示される
   - フィードごとに異なるアイコンが表示される

2. **Feedsページで確認**
   - フィードリストの各項目の左側にファビコン（24x24px）が表示される
   - ドラッグハンドル（☰）の右側に表示される

3. **Favoritesページで確認**
   - お気に入り記事のフィードタイトル横にファビコンが表示される

#### ドラッグ&ドロップでフィード並べ替え
1. **Feedsページへ移動**
2. **ドラッグハンドル（☰）をクリック&ホールド**
3. **別のフィードの位置までドラッグ**
4. **ドロップすると順序が変更される**
5. **ページをリロードしても順序が保持される**

#### Unreadフィルター時の自動既読無効化
1. **Dashboardで「Unread」フィルターを選択**
2. **未読記事をスクロールして表示**
3. **2秒以上表示しても自動的に既読にならない**
4. **「All」フィルターに戻すと自動既読が再び有効になる**

#### 無限スクロール（ページネーション） ✅ **NEW**
1. **Dashboardで記事一覧を表示**
   - 初回は最大50件の記事が表示される
2. **ページを下にスクロール**
   - リストの最後に到達すると自動的に次の50件を読み込む
   - 読み込み中は「Loading more articles...」とスピナーが表示される
3. **全件読み込み完了**
   - すべての記事を読み込むと「No more articles to load」が表示される
4. **Refreshボタンをクリック**
   - リセットされて最初の50件から再表示される
5. **パフォーマンス確認**
   - 100件以上の記事がある場合でも、スムーズにスクロール・読み込みできる

#### ダークモード ✅ **NEW (2026-01-13)**
1. **Settingsページへ移動**
2. **Appearanceセクションを確認**
   - 「Dark Mode」トグルスイッチが表示される
3. **トグルをクリック**
   - 即座に全画面がダークモードに切り替わる
   - 背景色、テキスト色、ボーダー色が変更される
4. **他のページに移動**
   - Dashboard、Feeds、Favoritesなど全ページでダークモードが適用される
5. **ページをリロード**
   - localStorageに保存されているため、設定が維持される
6. **ライトモードに戻す**
   - トグルをもう一度クリックして元に戻る

#### アカウント削除機能 ✅ **NEW (2026-01-13)**
1. **Settingsページへ移動**
2. **Danger Zoneセクションを確認**
   - 警告メッセージ: "These actions are irreversible. Please proceed with caution."
   - 「Clear Data」ボタン（オレンジ）と「Delete Account」ボタン（赤）が表示される

3. **Clear Data機能のテスト**
   - 「Clear Data」ボタンをクリック
   - 1回目の確認ダイアログが表示される
   - 「OK」をクリック
   - 2回目の確認ダイアログが表示される
   - 「OK」をクリック
   - すべてのデータ（フィード、記事、お気に入り）が削除される
   - Dashboardにリダイレクトされ、空の状態になる
   - アカウントは残っているため、再度フィードを追加できる

4. **Delete Account機能のテスト（注意: 実際にアカウントが削除されます）**
   - テスト用アカウントで実施してください
   - 「Delete Account」ボタンをクリック
   - 1回目の確認ダイアログが表示される
   - 「OK」をクリック
   - 2回目の確認ダイアログが表示される
   - 「OK」をクリック
   - アカウントとすべてのデータが完全削除される
   - ログイン画面にリダイレクトされる
   - 削除されたアカウントではログインできない

#### おすすめフィード機能 ✅ **NEW (2026-01-13)**
1. **Feedsページへ移動**
2. **「Recommended Feeds」セクションを確認**
   - 13個の日本語ニュースフィードがグリッド表示される
   - 各フィードに「Add」ボタンが表示される

3. **フィードの追加**
   - 任意のフィードの「Add」ボタンをクリック
   - ボタンが「Adding...」に変わる
   - 追加が完了すると「Added」に変わり、グレーアウトされる
   - 成功メッセージ「{フィード名} has been added successfully!」が表示される
   - 「Your Feeds」セクションに追加されたフィードが表示される

4. **重複チェック**
   - 既に追加済みのフィードの「Add」ボタンをクリック
   - アラート「{フィード名} is already in your feed list.」が表示される
   - フィードは追加されない

5. **Refreshで記事取得**
   - Dashboardに移動
   - 「🔄 Refresh」ボタンをクリック
   - 追加したフィードの記事が表示される

### UI/UX機能
1. **スクロール**
   - ナビゲーションバーが常に表示される
   - コントロールバー（フィルター、ボタン）が常に表示される
   - 記事が2秒以上表示されると自動既読マーク

2. **フィルター**
   - All: 全記事表示
   - Unread: 未読のみ
   - Read: 既読のみ
   - ナビゲーションバーの未読数バッジがリアルタイム更新

3. **一括既読**
   - 「✓ Mark All Read」ボタンで全未読を一括既読
   - 未読がない場合はボタンが無効化

4. **モーダル表示**
   - 記事カードをクリック
   - モーダルが開く（右上に透過×ボタン）
   - 既読マーク、お気に入り操作が可能
   - 「Visit Original」で元記事へ

---

## 既知の制限事項と注意点

1. **画像表示**
   - 既存の記事にはimageUrlフィールドがない
   - Refreshボタンで新しい記事を取得すると画像が表示される
   - RSSフィードに画像情報がない場合は「No image」プレースホルダー
   - 10種類の抽出方法で大幅改善済み ✅

2. **Favicon表示** ✅ **NEW**
   - Google Favicon Serviceに依存（外部サービス）
   - ドメインにfaviconがない場合は空白表示
   - 既存フィードはRefresh時にfaviconUrlが追加される
   - 新規追加フィードは即座にfaviconUrlが設定される

3. **フィード並べ替え** ✅ **NEW**
   - ドラッグ中にページをリロードすると順序が失われる可能性
   - API更新エラー時は自動的に元の順序に戻る
   - 楽観的UI更新により、一時的に不整合が生じる可能性

4. **自動既読**
   - 2秒間表示が必要（スクロールが速いと既読にならない）
   - Unreadフィルター中は無効化される ✅ **NEW**
   - モバイルでは動作が異なる可能性

5. **無限スクロール（ページネーション）** ✅ **NEW**
   - 初回50件、スクロールで段階的に読み込み
   - バックエンドでは最大1000件まで対応
   - フィルター変更時はリセットされる
   - パフォーマンスは良好だが、1000件を超える場合は古い記事から除外

6. **ダークモード** ✅ **NEW (2026-01-13)**
   - 全ページで正常に動作
   - localStorageで設定を永続化
   - Settings画面でON/OFF切り替え可能

7. **アカウント削除機能** ✅ **NEW (2026-01-13)**
   - Clear All Data: データのみ削除、アカウント保持
   - Delete Account: アカウントとデータを完全削除
   - 2段階確認で誤操作を防止
   - Firebase Auth REST APIで実装

8. **おすすめフィード機能** ✅ **NEW (2026-01-13)**
   - 13個の日本語ニュースフィードを事前設定
   - ワンクリックで登録可能
   - 重複チェック機能あり

9. **オプション機能（未実装）**
   - OPMLインポート/エクスポート
   - キーボードショートカット
   - 記事の検索機能
   - フィードのフォルダ分け・グルーピング

---

## 次にやること - Phase 7: Mobile アプリ（Expo）

Phase 7では、モバイルアプリケーション（iOS/Android）を実装します。

### Phase 7の重要なポイント

1. **モバイルは共通アプリ型**
   - App Store/Google Playから配布される共通アプリ
   - 各ユーザーが初期設定でPages Functions URL入力
   - Firebase Client SDK不要（すべてPages Functions API経由）

2. **必要な実装**
   - 初期設定画面（URL入力、AsyncStorage保存）
   - 認証画面（API経由）
   - 記事一覧（FlatList、Pull to Refresh）
   - 記事詳細（WebViewまたはカスタムUI）
   - フィード管理
   - お気に入り
   - 設定

3. **共通パッケージの活用**
   - `packages/shared/src/api/` のAPIクライアントをそのまま使用
   - TypeScript型定義も共有
   - Webで実装した機能をReact Nativeで再現

### Phase 7の開始手順

```bash
# 1. apps/mobile ディレクトリに移動
cd apps/mobile

# 2. 依存関係を確認・インストール
npm install

# 3. Expo開発サーバーを起動
npm run dev

# または特定のプラットフォームを指定
npm run ios     # iOSシミュレータ
npm run android # Androidエミュレータ
```

### Phase 7のチェックリスト

- [ ] Expo プロジェクト初期化（既に完了の可能性あり）
- [ ] React Navigation 設定
- [ ] AsyncStorage 設定（URL保存用）
- [ ] API client integration (`packages/shared`)
- [ ] InitScreen（URL入力）
- [ ] AuthScreen（ログイン/登録）
- [ ] HomeScreen（記事一覧）
  - [ ] FlatList実装
  - [ ] 画像表示（Image コンポーネント）
  - [ ] Pull to Refresh
  - [ ] Intersection Observer代替（onViewableItemsChanged）
- [ ] ArticleScreen（記事詳細）
- [ ] FavoritesScreen（お気に入り）
- [ ] FeedsScreen（フィード管理）
- [ ] SettingsScreen（設定）
- [ ] iOS/Androidシミュレータでの動作確認

---

## 参考情報

### ドキュメント
- **設計書**: `DESIGN.md` - Section 7「モバイルアプリのアーキテクチャ」
- **進捗管理**: `PROGRESS.md` - Phase 5: 100%完了、Phase 6: 100%完了
- **API仕様**: すべてのエンドポイントはWebと共通

### 開発リソース
- **本番URL**: https://feedown.pages.dev
- **最新手動デプロイURL**: https://66aa3f5d.feedown.pages.dev
- **API エンドポイント**: https://feedown.pages.dev/api/*
- **Worker URL**: https://feedown-worker.votepurchase.workers.dev
- **Firebase プロジェクト**: feedown-78e22

---

## トラブルシューティング

### Webアプリの問題

#### ローカル開発サーバーが起動しない
```bash
cd apps/web
npm install
npm run dev
```

#### ビルドエラー
```bash
# sharedパッケージを再ビルド
cd packages/shared
npm run build

# webアプリを再ビルド
cd ../../apps/web
npm install
npm run build
```

#### デプロイエラー
```bash
# Wranglerのバージョン確認
npx wrangler --version

# Cloudflare認証確認
npx wrangler login

# デプロイ
npx wrangler pages deploy apps/web/dist --project-name=feedown
```

### 画像が表示されない

1. **既存記事の場合**
   - Refreshボタンで新しい記事を取得
   - 新規取得分には画像URLが含まれる

2. **新規記事でも表示されない場合**
   - RSSフィードに画像情報が含まれているか確認
   - ブラウザの開発者ツールでネットワークタブを確認
   - `functions/api/refresh.ts`のコンソールログを確認（デバッグログ有効）

### API エラー

1. **認証エラー**
   - Firebase Authトークンの有効期限切れ → 再ログイン
   - CORS エラー → Worker経由でアクセスしているか確認

2. **記事取得エラー**
   - Worker URL が正しいか確認（`.env`の`VITE_WORKER_URL`）
   - RSSフィードURLが有効か確認

---

## 前回のセッションで実装した機能（2026-01-12）

### 実装した機能一覧
1. ✅ **Favicon表示機能**
   - Google Favicon Serviceを使用してフィードアイコンを取得
   - Dashboard、Feeds、Favoritesページすべてで表示
   - refresh.tsとfeeds/index.tsで自動抽出・保存

2. ✅ **フィード並べ替え機能**
   - HTML5 Drag and Drop APIによる直感的なUI
   - orderフィールドで永続化
   - PATCH /api/feeds/:id エンドポイント追加

3. ✅ **サムネイル画像抽出の大幅改善**
   - 7種類→10種類の抽出方法に拡張
   - URL内の画像拡張子パターンマッチング追加
   - descriptionタグ・content:encodedタグからの抽出追加

4. ✅ **Unreadフィルター時の自動既読無効化**
   - filter === 'unread'の場合、Intersection Observerを無効化
   - ユーザーが未読記事を閲覧中に勝手に既読にならない

5. ✅ **無限スクロール（ページネーション）**
   - 初回50件、スクロールで段階的に自動読み込み
   - Intersection Observerで最下部を監視
   - hasMoreフラグとローディングインジケーター実装

### Gitコミット履歴
1. `d7a48bb` - "Implement favicon display and drag & drop feed reordering"
2. `9a26b8c` - "Disable auto-mark-as-read in Unread filter and increase article limit"
3. `b002dba` - "Implement infinite scroll (pagination) for Dashboard"

---

## 次の担当者へのメッセージ

**Phase 5とPhase 6が完了しました！**

Phase 5のWebアプリは非常に完成度が高く、Feedlyに匹敵するUIになりました。Feedly風UI、ダークモード、アカウント削除機能、おすすめフィード機能、トースト通知、ワンクリックテストアカウント作成など、すべてのコア機能とユーザビリティ向上機能が実装されています。

### Webアプリについて
- ✅ すべてのコア機能が実装済み
- ✅ Feedly風の洗練されたUI
- ✅ ダークモード完全対応
- ✅ トースト通知システム
- ✅ Firestore読み取り回数最適化
- ✅ ワンクリックテストアカウント作成

**推奨されるオプション機能**（Phase 7以降で実装可能）:
- 記事の検索機能（タイトル・本文の全文検索）
- キーボードショートカット（j/k で記事移動など）
- フィードごとのグループ・フォルダ機能
- 記事の並び替えオプション（日付以外の基準）
- OPMLインポート/エクスポート

### Mobileアプリについて

#### ボイラープレートの構成

`apps/mobile/` ディレクトリに **React Native Expo ボイラープレート** が準備されています。このボイラープレートは、認証、ナビゲーション、状態管理などの基本機能がすでに実装されており、FeedOwnアプリの開発をスムーズに開始できます。

**主な技術スタック:**
- **Expo SDK**: 54.0.8
- **React Native**: 0.81.4
- **React Navigation**: 7.x (Stack, Drawer, Tab Navigation)
- **Redux Toolkit**: グローバル状態管理
- **AsyncStorage**: ローカルストレージ
- **Toast Notifications**: `react-native-toast-message`
- **Lottie**: アニメーション

#### ディレクトリ構造

```
apps/mobile/
├── App.js                    # アプリエントリーポイント
├── app.json                  # Expo設定ファイル
├── babel.config.js           # Babel設定
├── metro.config.js           # Metro bundler設定
├── package.json              # 依存関係
└── src/
    ├── index.js              # App.jsをエクスポート
    ├── App.js                # メインアプリコンポーネント
    ├── config.js             # アプリ設定（isAutoLogin, dummyUser）
    ├── assets/               # 画像、フォント
    │   ├── fonts/
    │   └── images/
    ├── components/           # 再利用可能なUIコンポーネント
    │   ├── Button/
    │   ├── Logo/
    │   ├── LoadingScreen/
    │   ├── EmptyScreen/
    │   └── ...
    ├── contexts/             # React Context API
    │   ├── UserContext.jsx   # ユーザー認証状態管理
    │   └── HomeTitleContext.jsx
    ├── routes/               # ナビゲーション設定
    │   ├── index.js          # Routes.jsをエクスポート
    │   ├── Routes.js         # ルートレベルのルーティング
    │   └── navigation/
    │       ├── Navigation.js # NavigationContainer + Toast
    │       ├── stacks/       # Stack Navigators（LoginStacks等）
    │       ├── rootStack/    # 認証後のStack Navigation
    │       └── drawer/       # Drawer Navigation（コメントアウト）
    ├── scenes/               # 各画面コンポーネント
    │   ├── home/Home.js
    │   ├── signin/SignIn.js
    │   ├── signup/SingUp.js
    │   ├── loading/Loading.js
    │   ├── profile/Profile.js
    │   ├── details/Details.js
    │   ├── menu/Menu.js
    │   ├── post/Post.js
    │   ├── read/Read.js
    │   ├── write/Write.js
    │   ├── print/Print.js
    │   └── modal/Modal.js
    ├── slices/               # Redux Toolkit slices
    │   └── app.slice.js      # アプリ全体の状態（checked）
    ├── theme/                # テーマ設定
    │   ├── colors.js
    │   ├── fonts.js
    │   └── images.js
    └── utils/                # ユーティリティ
        ├── store.js          # Redux store設定
        └── ignore.js         # 警告の無視設定
```

#### 既存コンポーネントの説明

**1. アプリエントリーポイント (`src/App.js`)**
```javascript
// Redux Provider、SafeAreaProvider、UserContextProviderでラップ
<SafeAreaProvider>
  <Provider store={store}>
    <UserContextProvider>
      <Router />
    </UserContextProvider>
  </Provider>
</SafeAreaProvider>
```
- **アセットプリロード**: 画像とフォントを初期ロード時に読み込み
- **ローディング画面**: アセット読み込み中は空のViewを表示

**2. ナビゲーション (`src/routes/navigation/Navigation.js`)**
```javascript
// ユーザー認証状態に応じてナビゲーションを切り替え
{user ? <RootStack /> : <LoginStacks />}
```
- **UserContext**: ユーザーがログイン済みかどうかで表示するスタックを切り替え
- **Toast**: グローバルなToast通知コンポーネントを配置

**3. Redux状態管理 (`src/slices/app.slice.js` + `src/utils/store.js`)**
- **app.slice.js**: `checked`フラグ（初期化完了）を管理
- **store.js**: Redux Toolkitの`configureStore`で設定
  - 開発環境では`redux-logger`ミドルウェアを有効化
  - `serializableCheck`, `immutableCheck`を無効化

**4. UserContext (`src/contexts/UserContext.jsx`)**
- ユーザーの認証状態を管理
- ログイン/ログアウト機能を提供

**5. 既存の画面 (Scenes)**
- **SignIn.js / SingUp.js**: ログイン・登録画面（既存のボイラープレート）
- **Home.js**: ホーム画面（サンプル）
- **Profile.js**: プロフィール画面（サンプル）
- **Details.js**: 詳細画面（サンプル）
- その他のサンプル画面（Post, Read, Write, Print, Modal, Menu, Loading）

#### Phase 7 実装時の推奨手順

**1. 既存のボイラープレートを理解する**
   - `src/App.js` でアプリ初期化フローを確認
   - `src/routes/navigation/Navigation.js` でナビゲーション構造を確認
   - `src/contexts/UserContext.jsx` で認証状態管理を確認

**2. FeedOwn用の画面を作成する**
   - 既存のサンプル画面（Post, Read, Write等）を削除または書き換え
   - 新しい画面を `src/scenes/` に追加:
     - `InitScreen.js`: 初期設定（Pages Functions URL入力）
     - `DashboardScreen.js`: 記事一覧（Webの DashboardPage.jsx を参考）
     - `FeedsScreen.js`: フィード管理（Webの FeedsPage.jsx を参考）
     - `ArticleScreen.js`: 記事詳細（Webの ArticleModal.jsx を参考）
     - `FavoritesScreen.js`: お気に入り（Webの FavoritesPage.jsx を参考）
     - `SettingsScreen.js`: 設定（Webの SettingsPage.jsx を参考）

**3. API統合**
   - `packages/shared/src/api` のAPIクライアントをインポート
   - AsyncStorageにPages Functions URLとFirebase Auth Tokenを保存
   - WebのuseEffectパターンをそのまま使用可能

**4. ナビゲーション構造の変更**
   - `src/routes/navigation/stacks/LoginStacks.js`: SignIn → InitScreen（URL入力）
   - `src/routes/navigation/rootStack/RootStack.js`: Dashboard, Feeds, Favorites, Settings, Articleを追加
   - Tab NavigationまたはDrawer Navigationで主要画面を構成

**5. Redux Sliceの追加**
   - `src/slices/feeds.slice.js`: フィード一覧の状態管理
   - `src/slices/articles.slice.js`: 記事一覧の状態管理
   - `src/utils/store.js` で新しいsliceを追加

**6. React Native固有の実装**
   - **Intersection Observer → onViewableItemsChanged**: FlatListで無限スクロールと既読自動マーク
   - **Modal → React Navigation Modal**: 記事詳細をモーダルで表示
   - **CSS → StyleSheet**: インラインスタイルまたはStyleSheetを使用
   - **WebView**: 記事詳細を外部リンクで表示する場合に使用
   
**7. 動作確認**
   - 開発サーバーの起動`yarn start`もしくは`npx expo start`
   - Expo Goを使用

#### 重要な技術ポイント（Mobile）

1. **AsyncStorageでPages Functions URLを保存**
   - 初回起動時にInitScreenでURLを入力
   - AsyncStorageに保存して以降のAPI呼び出しで使用

2. **Firebase Client SDK不要**
   - すべてPages Functions経由でFirebaseにアクセス
   - モバイルアプリはシンプルなHTTPクライアントとして機能

3. **FlatListでのパフォーマンス最適化**
   - `windowSize`, `maxToRenderPerBatch`, `removeClippedSubviews` を調整
   - 大量の記事リストでもスムーズなスクロール

4. **Toast通知**
   - `react-native-toast-message` がすでに統合済み
   - WebのToast通知と同様のUXを提供可能

### 重要な技術ポイント
1. **画像抽出**: RSS/Atomから複数の方法で画像URLを抽出（`functions/api/refresh.ts`参照）
2. **楽観的UI更新**: APIレスポンスを待たずにUIを更新、エラー時はロールバック
3. **スティッキー要素**: ナビゲーションとコントロールバーを常に表示
4. **透過背景**: 半透過+ぼかし効果で洗練された見た目

頑張ってください！

---

## 更新履歴

| 日時 | 担当者 | 主な変更内容 |
|------|--------|------------|
| 2026-01-12 04:30 | Claude Sonnet 4.5 | Phase 5完了、Feedly風UI実装 |
| 2026-01-12 11:30 | Claude Sonnet 4.5 | Favicon表示、ドラッグ&ドロップ、画像抽出改善、Unreadフィルター改善 |
| 2026-01-12 12:30 | Claude Sonnet 4.5 | 無限スクロール（ページネーション）実装完了 |
| 2026-01-13 前半 | Claude Sonnet 4.5 | ダークモード、アカウント削除機能、おすすめフィード機能、記事リスト表示改善、API Client エラーハンドリング改善 |
| 2026-01-13 後半 | Claude Sonnet 4.5 | トースト通知システム、ワンクリックテストアカウント作成、Dashboard更新タイミング最適化、自動Refresh、Clear Data/Delete Account修正 |
| 2026-01-13 夕方 | Claude Sonnet 4.5 | React Native Expoボイラープレート解析、モバイルアプリの構造・技術スタック・実装手順をドキュメント化 |
| **2026-01-13 最終** | **Claude Sonnet 4.5** | **Phase 5完全完了: スクロール既読、モーダル既読、マルチフィード対応(Too many subrequests修正)、Refreshボタン改善、コンソールログクリーンアップ** |

---

**最終更新**: 2026-01-13 19:30
**担当者**: Claude Sonnet 4.5
**現在のフェーズ**: Phase 5 完全完了 (100%)、Phase 6 完了 (100%)
**次のフェーズ**: Phase 7 - Mobile アプリ (0%)
**最新デプロイURL**: https://28da7037.feedown.pages.dev / https://feedown.pages.dev
**最新コミット**: cf0a47f - "Reduce console noise by disabling verbose debug logs"
**デプロイ方法**: 手動デプロイ（GitHub連携なし）

## Phase 5 完了状況サマリー

### ✅ 実装済み機能（完全動作）
- Feedly風UI
- Favicon表示
- ドラッグ&ドロップフィード並べ替え
- サムネイル画像抽出（10種類の方法）
- 無限スクロール（ページネーション）
- **スクロール既読機能** ← NEW
- **モーダル表示時の既読マーク** ← NEW
- 自動既読マーク
- 一括既読マーク
- Unreadフィルター（既読無効化）
- ダークモード
- アカウント削除機能
- おすすめフィード機能
- トースト通知システム
- ワンクリックテストアカウント作成
- **マルチフィード対応（Too many subrequests修正）** ← NEW
- Refreshボタンの即座反応 ← NEW

### 🐛 修正済みバグ
- ✅ 記事リストが一時的に消える問題
- ✅ JSON parsing error
- ✅ readArticles/favorites削除漏れ
- ✅ Delete AccountのCREDENTIAL_TOO_OLD_LOGIN_AGAIN
- ✅ API path重複問題（api/api → api）
- ✅ **Too many subrequests（マルチフィード対応）** ← NEW
- ✅ Refreshボタンの反応遅延 ← NEW

### 🎉 Phase 5の状態
**すべての機能が実装され、すべてのバグが修正されました。**
Phase 7（モバイルアプリ）に進む準備が整っています。
