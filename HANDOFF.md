# 引継ぎメモ - API `DELETE /api/feeds/{id}` の404エラー調査

## 概要

`HANDOFF.md`の指示に基づき、Cloudflare Pages Functionsのデプロイとテストを実施しました。
その過程で、`DELETE /api/feeds/{id}`エンドポイントが`404 Not Found`エラーを返す問題が特定され、その調査を行いました。

**最終デプロイURL:** `https://39ab0d28.feedown.pages.dev`

## 作業サマリー

1.  **Pages Functionsのデプロイ完了**
    -   Cloudflareの環境変数を設定。
    -   TypeScriptの型エラー（`unknown`型関連）を`any`型を追加して修正し、コンパイルが通る状態にしました。
    -   `HANDOFF.md`の指示に従い、Cloudflare Pagesへのデプロイを完了しました。

2.  **E2Eテストスクリプトの作成**
    -   デプロイしたAPIを検証するため、Python製のE2Eテストスクリプトを作成しました。
    -   場所: `tests/api_test.py`
    -   使い方: `tests/README.md`

## 現在の状況と残っている問題

`tests/api_test.py`によるテストの結果、`DELETE /api/feeds/{id}`を除く全てのAPIエンドポイントは正常に動作することを確認しました。

-   [✓] `POST /api/auth/register`
-   [✓] `POST /api/auth/login`
-   [✓] `POST /api/feeds`
-   [✓] `GET /api/feeds`
-   [✓] `POST /api/refresh`
-   [✓] `GET /api/articles`
-   **[✗] `DELETE /api/feeds/{id}` (404 Not Found)**

`Add Feed` API (POST) は成功し、FirestoreのドキュメントIDを返しますが、`Delete Feed` API (DELETE) は同じIDのドキュメントを見つけられず、404エラーになります。

## 調査済みのこと

1.  **TypeScriptビルド漏れの確認**
    -   当初、`.ts`ファイルの変更が`.js`に反映されていない可能性を疑いました。
    -   `functions`ディレクトリで`npm run build`を再実行し、再デプロイしましたが問題は解決しませんでした。

2.  **デバッグログの追加と確認**
    -   `functions/api/feeds/[id].ts`にデバッグログを追加し、再デプロイしました。
    -   Cloudflareのログから、DELETEリクエスト時に`getDocument`関数が`Feed not found`で失敗していることを確認しました。
    -   ログに記録されたFirestoreのパスは`users/{uid}/feeds/{feedId}`の形式で、正しく構築されているように見えます。

## 次にやること（仮説と検証）

根本原因は、**「`Add Feed`でデータがFirestoreに正しく書き込めていない」**可能性が高いです。

以下の手順で調査を進めてください。

1.  **Firestoreデータの直接確認（最優先）**
    -   `tests/api_test.py`を実行し、`Add Feed`が成功した時点でスクリプトを一時停止します。
    -   `idToken`を[jwt.io](https://jwt.io/)などのサイトでデコードして`user_id`（これが`uid`）を取得します。
    -   テストスクリプトの出力から`feedId`を特定します。
    -   **Firebaseコンソール**で、`users/{uid}/feeds/{feedId}`のパスにドキュメントが**実際に存在するか**を直接確認してください。

2.  **`createDocument`関数の調査**
    -   もし上記1でドキュメントが存在しなかった場合、`lib/firebase-rest.ts`の`createDocument`関数が、実際には書き込みに失敗しているのに成功したかのようなレスポンスを返している可能性があります。
    -   Firestore REST APIの仕様と突き合わせ、リクエストやレスポンスの処理に問題がないか詳細に確認してください。

3.  **セキュリティルールの再確認**
    -   Firestoreのセキュリティルールが、`createDocument`（書き込み）は許可するが、`getDocument`（読み込み）を（特定の条件下で）拒否するような設定になっていないか、再度確認してください。

## 参考情報

-   **API E2Eテストスクリプト:** `tests/api_test.py` (詳細は`tests/README.md`を参照)
-   **DELETEエンドポイントのデバッグログ:** `functions/api/feeds/[id].ts`に実装済みです。Cloudflareダッシュボードのリアルタイムログで確認できます。

---
**最終更新**: 2026-01-12
**担当者**: Gemini
**次の担当者へ**: 上記「次にやること」の検証をお願いします。