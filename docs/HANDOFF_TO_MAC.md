# Mac セッションへの引継ぎ: 新着通知の強化（BRUSHUP #27）

**作成日**: 2026-11-22（Windows セッション）
**一次資料**: `docs/BRUSHUP_PLAN.md` の **#27 新着通知の強化**、および **#8 オフラインキャッシュ** の「バックグラウンド先読み」。設計判断はそちらに書いてある。このファイルは着手に必要な現状の事実と、決めて欲しい点だけをまとめたもの。終わったら削除する。

## やること

1.0.15 で出した「FeedOwn / N new articles」通知を、中身が分かる通知にする。**サーバー（`functions/`）は変更しない。** 端末側で新着を特定する。

順番:
1. **新着の取得と抽出**: refresh で `newArticles > 0` だったら、`GET /api/articles?unreadOnly=true&limit=100` を取り、`fetchedAt >= 実行開始時刻` の記事を今回の新着とする。
2. **27a**: 本文を内訳とタイトルにする。例「TechCrunch 5 · Hacker News 3」＋最新タイトル 1〜2 本。
3. **27b**: 新着が 1 件だけなら、その記事を通知してタップで記事詳細を開く。
4. **27c**: フィードごとに通知のオン/オフを切り替えられるようにする。
5. **27d**: キーワード通知。しきい値に関係なく即通知し、照合は NFKC 正規化＋大文字小文字無視。
6. **27e**: ホーム右上にベルを置き、通知のオン/オフをその場で切り替えられるようにする。詳細は下の「27e の置き場所」。

27a〜27e を全部作ってから 1.0.16 としてまとめてストア提出する（下の決定事項）。#8（オフラインキャッシュ）は別項目。手順 1 の取得はキャッシュの先読みと同じリクエストなので、後から保存処理を足せる形にしておく。

## 現状のコード（1.0.15）

- **`apps/mobile/src/utils/backgroundRefresh.js`**: ほぼすべてここにある。
  - `check()` が 1 回分の実行。`refreshOnce()`（POST /api/refresh を 1 回）→ しきい値判定 → `presentNewArticles(count, foreground)`。
  - バックグラウンド実行時は React も Redux もマウントされていない。設定とトークンは AsyncStorage から読む。
  - 保存先:
    - 設定: `@feedown_bg_refresh_settings` `{enabled, notify, threshold}`
    - 状態: `@feedown_bg_refresh_state` `{unseen, pending}`
    - ログ: `@feedown_bg_refresh_runs`（最新 20 件）
  - `unseen` は最後にアプリを開いてからの新着数、`pending` はそのうち未通知の分。アプリを開くと `consumeBackgroundNewArticles()` で両方 0 になる。
    - 27a〜27c では、この状態に `items`（新着の id・title・feedId・feedTitle、最新 20 件程度）と `byFeed` を足し、同じタイミングでクリアする。
  - 通知は identifier `feedown-new-articles` の 1 通を使い回す。iOS では同じ identifier で再投稿すると無音で更新されるだけなので、`dismissNotificationAsync` してから出し直している。
    - 27d は別 identifier（例 `feedown-keyword`）にする。
  - `data.foreground` が付いた通知だけ、フォアグラウンドでもバナーを出す（`setNotificationHandler`）。Check Now とテスト通知用。
  - `check({foreground: true})` が Check Now。しきい値は判定するが、状態のカウンタには触れない。
- **`apps/mobile/src/routes/navigation/Navigation.js`**: `useNewArticlesNotificationTap()` で、`data.type === 'new-articles'` の通知がタップされたら Home へ移動する。
  - アプリ終了状態からの起動は `getLastNotificationResponseAsync` で処理している。
  - 27b では `data.articleId` があるときに `ArticleDetail` へ移動する。ただし `ArticleDetail` は `route.params.article`（**記事オブジェクトそのもの**）を受け取る（`src/scenes/article/ArticleDetail.js:39`、Home からは `navigation.navigate('ArticleDetail', { article })`）。
  - 記事の単体取得 API は無い。手段は 2 つ:
    - 通知の `data` に表示に必要な最小限の記事データを入れる
    - 一覧を取り直して id で探す
  - どちらにするか、ArticleDetail が使うフィールドを見て決める。
- **`apps/mobile/src/scenes/profile/BackgroundRefreshSettings.js`**: 設定画面。スイッチ、しきい値、Test Notification、Check Now、Recent Runs がある。27c のフィード一覧と 27d のキーワード入力もここに足す。
- **`apps/mobile/src/scenes/home/Home.js`**: ヘッダーは左に「FeedOwn」、右（`headerRight`、gap 10）にフィードのドロップダウン（幅 120）と未読バッジ（「123 unread」/「All read」）。27e のベルはこの右端に足す。
- **`apps/mobile/src/contexts/FeedsContext.js`**: フォアグラウンドに戻ったときに `consumeBackgroundNewArticles()` を呼んで一覧を再読み込みする。`onBackgroundArticles` は、実行中にアプリが開かれた場合の通知経路。
- **`apps/mobile/src/utils/api.js`**: `createApiClient().articles.list({ unreadOnly, limit })` がある（limit の上限は 100）。
  - レスポンスの各記事には `id, title, feedId, feedTitle, fetchedAt, publishedAt` などが入っている（`functions/api/articles/index.ts`）。
  - 並びは `published_at` の降順。
- **レート制限**: `functions/_middleware.ts` の 30 秒制限は POST /api/refresh だけで、GET /api/articles にはかからない。

## 注意点

- **iOS のバックグラウンド実行は約 30 秒で打ち切られる**: 開始から 15 秒を超えていたら一覧取得を飛ばし、従来の「N new articles」にフォールバックする。取得に失敗したときも同じ。
- **合計件数は refresh の `newArticles` を使う**: 一覧から特定できた件数が少ないことがある（公開日が古い記事は上位 100 件から漏れうる）。差分は「ほか N」として出す。
- **27c の件数の扱い**: オフにしたフィードの新着も `unseen` には数える（一覧の再読み込み用）。`pending` と通知本文からは除く。
- **Recent Runs のログ**: 一覧取得の成否と特定できた件数も残すと、実機での確認が楽になる。
- **ネイティブ依存は増えない見込み**:
  - `runtimeVersion` は `appVersion` ポリシーで、EAS Update も設定済みなので、JS だけの変更なら技術的には OTA でも出せる。
  - ただしユーザー決定によりストア提出で出す: 1.0.16（iOS buildNumber 22 / Android versionCode 17）。前回と同じく Mac の `eas build --local`。

## 27e の置き場所（2026-11-22 ユーザー決定）

```
FeedOwn      [All Feeds ▾] (123) 🔔
```

- ヘッダー右端にベルを置く。13 mini（375pt）では今のヘッダーに約 30pt しか余りがなく、そのままでははみ出す。そこで未読バッジを短くする: 「123 unread」→「123」、「All read」→「✓」。色分けはそのまま。
- 幅は Windows 側の見積もりなので、実機で見て調整する（ドロップダウンを狭める案とフィルタバーに置く案は不採用）。
- **タップ**: `settings.notify` を切り替えてトーストを出す。`enabled` がオフなら確認してから両方オン。OS の通知許可がなければ許可を求め、拒否済みなら OS の設定へ案内する。
- **長押し**: Background Refresh 設定を開く。
- **アイコン**: 通知が届く状態ならベル、届かない状態（`notify` オフ / `enabled` オフ / OS 許可なし）なら斜線入りのベル。
- 設定画面とずれないよう、フォーカスのたびに AsyncStorage の設定を読み直す。
- フィードごとのオン/オフ（27c）はベルに載せない。
- 通知センター（通知履歴の画面）は作らない。未読一覧がそのまま履歴になるため（BRUSHUP_PLAN の判断記録）。

## 決定事項（2026-11-22 ユーザー回答）

1. **通知の文言は英語のまま**。多言語化はしない。
2. **27c で通知をオフにしたフィードは、キーワードに一致しても通知しない**。オフのフィードは通知に一切関わらない（`unseen` に数えるだけ）。
3. **27a〜27e を全部作ってからまとめてリリース**。途中では出さない。
4. **ストア提出（1.0.16）**。OTA では出さない。iOS buildNumber 22 / Android versionCode 17。ビルドと提出の前にユーザーに確認する。

## 確認方法

- Settings の Check Now は実データで 27a〜27d の文面を出す。Test Notification はダミーデータで各文面を確認できるようにする。
- 一覧取得を失敗させて、従来の文面に戻ること。
- 27b: フォアグラウンド、バックグラウンド、アプリ終了状態のそれぞれからタップして、該当記事が開くこと。
- 27e: ベルの表示が設定画面と一致すること。OS の通知許可を切ると斜線になること。13 mini でヘッダーがはみ出さないこと。
- 実機（iPhone 13 mini）でバックグラウンド実行を待ち、Recent Runs と通知の中身が一致すること。

## 終わったら

- `docs/BRUSHUP_PLAN.md` の表で #27 に ✅ を付け、判断記録に完了の記録を書く。
- `docs/PROGRESS.md` のリリース記録を追記する。
- このファイルを削除する。
