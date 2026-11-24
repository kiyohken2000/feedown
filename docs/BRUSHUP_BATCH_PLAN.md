# ブラッシュアップ一括実装計画（#14 / #4 / #8 / キーワード強調 / #18）

**作成日**: 2026-11-24
**状態**: 未着手。実施するかはユーザーが判断中。**やる場合は 5 項目をいっぺんに実装する**（2026-11-24 決定）。
**親計画**: `docs/BRUSHUP_PLAN.md`。各項目の背景はそちらの該当節にある。本書は 2026-11-24 時点のコードを確認したうえで、まとめて実装するための手順を書いたもの。

| 本書 | BRUSHUP | 内容 | 触る場所 | 規模 |
|---|---|---|---|---|
| A | #14 | aiCache の 7 日 TTL と削除 | mobile | 小 |
| B | #4 | フィード取得エラーの表示 | web, mobile | 小 |
| C | #8 | オフラインキャッシュとバックグラウンド先読み | mobile | 中 |
| D | 新規 | キーワードに一致した記事の強調表示 | mobile | 小 |
| E | #18 | サイト URL からのフィード自動発見 | functions, web, mobile | 小 |

**共通の前提**
- 新しいネイティブ依存はない。モバイルはすべて JS だけの変更。
- DB スキーマは変えない。#4 に必要な列（`error_count` / `last_success_at`）は既にある。
- キーワードと通知の設定は端末ローカルのまま。Web と同期しない（2026-11-24 決定。理由: キーワードの主な用途はモバイルの通知で、Web 側の使い道は強調表示しかない。必要になったら同期をまとめて作る）。

---

## A. aiCache の 7 日 TTL（#14）

**現状**: `apps/mobile/src/ai/aiCache.js` には期限切れの判定がなく、削除する処理もない。レコードには `makeRecord()` で `createdAt` が付いている。キーの接頭辞は `apps/mobile/src/ai/aiStorage.js` の `AI_KEYS.SUMMARY_PREFIX`（`feedown:ai:summary:`、視点要約と信号分離の両方）と `AI_KEYS.TRANSLATION_PREFIX`（`feedown:ai:translation:`）。

**変更**
1. `aiCache.js`
   - `AI_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000` を追加する。
   - `isExpired(record)` を追加する。`createdAt` が無いか日付として読めないレコードは期限切れとして扱う（キャッシュなので消えても困らない）。
   - `isRecordValid()` と `getTranslationCache()` の判定に `isExpired` を足す。期限切れのレコードを読んだら、その場で `deleteCacheRecord` する。
   - `sweepExpiredAiCache()` を追加する。`AsyncStorage.getAllKeys()` から 2 つの接頭辞のキーを取り、`multiGet` で読み、期限切れか JSON として読めないものを `multiRemove` する。消した件数を返す。例外は投げない。
2. `apps/mobile/src/contexts/AiContext.js`: `AiProvider` の mount 時の `useEffect` で 1 回だけ呼ぶ。起動を遅らせないよう `await` せず、`InteractionManager.runAfterInteractions` の中で実行する。

**検証**: `createdAt` を 8 日前にしたレコードを書き込んで再起動すると消えていること。有効なレコードは残ること。期限切れのレコードを直接読むと null になること。

---

## B. フィード取得エラーの表示（#4）

**現状（確認済み）**
- サーバーは実装済み。`functions/api/refresh.ts` が失敗したら `updateFeedError()` で `error_count` を 1 増やし、成功したら 0 に戻して `last_success_at` を更新している。`GET /api/feeds` は `errorCount` / `lastSuccessAt` を返している（`functions/api/feeds/index.ts:52-53`）。
- 足りないのは UI だけ。サーバーの変更とデプロイは要らない。

**仕様**
- `errorCount >= 3` のフィードを「取得できていない」とみなす。閾値は Web とモバイルで共通の定数にする。モバイルは `apps/mobile/src/utils/` に置き、Web は同じ値を直書きする。`packages/shared` は使っていないので共有しない。
- 表示する内容:
  - ⚠ と「Not updating」の短いラベル（英語 UI に合わせる）。
  - 補足に「Last success: n days ago」。`lastSuccessAt` が null なら「Never fetched successfully」。
- 通知は出さない。死んだフィードの通知は 1.0.16 で採用しなかった案なので、ここでも足さない。

**変更**
1. Web `apps/web/src/pages/FeedsPage.jsx` の登録済みフィード一覧（661 行目付近の `feedTitle` / `feedUrl`）: タイトルの横にバッジを付ける。`title` 属性で最終成功日時を出す。
2. Mobile `apps/mobile/src/scenes/read/Read.js` の `renderFeed`（170 行目付近）: タイトル行に ⚠ を付け、URL の下に「Last success …」を小さく出す。⚠ をタップすると Alert で説明を出し、そこから既存の削除確認に進めるようにする。
3. 並び順は変えない。エラーのフィードを上に寄せるのは、件数が多くて見つけにくいと分かってから検討する。

**検証**: 存在しない URL のフィードを DB に直接入れるか、既存フィードの `error_count` を 3 に書き換え、Web とモバイルにバッジが出ること。`error_count` を 0 に戻すと消えること。

---

## C. オフラインキャッシュとバックグラウンド先読み（#8）

**現状（確認済み）**
- `apps/mobile/src/contexts/FeedsContext.js` の `fetchArticles(reset, limit=50)` は、取得した記事を state に入れるだけで、どこにも保存していない。
- Home は起動時に `refreshAll()` を呼ぶ。これは `POST /api/refresh` を実行してから記事一覧を取り直すので、表示までに数秒かかる。
- バックグラウンド更新の `fetchNewArticles()`（`apps/mobile/src/utils/backgroundRefresh.js` 441 行目付近）は `GET /api/articles?unreadOnly=true&limit=100` を取っている。**Home の取得（既読も含めて 50 件）と範囲が違う**ので、そのまま上書き保存はできない。
- 通知タップで記事を開く処理（`Navigation.js` の `useNewArticlesNotificationTap`）は、通知の `data.article` に記事の中身を持たせているので、キャッシュが無くても開ける。キャッシュで速くなるのは、そのあと戻った先の一覧。
- `expo-network` は依存に入っているが、コードではまだ使っていない。

**キャッシュの形**
- 新規ファイル `apps/mobile/src/utils/articleCache.js`。React の外から使えるようにする（バックグラウンド実行では Context がマウントされていないため）。
- キーは `@feedown_articles_cache`。値は `{ v: 1, serverUrl, userId, savedAt, articles }`。
- `articles` は一覧 API の記事オブジェクトをそのまま、最大 100 件入れる。`isRead` は保存時点の既読状態を反映させる。
- 読み出すとき、`serverUrl` と `userId` が今のログインと違えば捨てる。別のアカウントや別のサーバーの記事を出さないため。
- 関数は `loadArticleCache()` / `saveArticleCache(articles)` / `mergeIntoArticleCache(unreadArticles)` / `clearArticleCache()`。どれも例外を投げない。

**変更**
1. **保存（FeedsContext）**: `articles` と `readArticles` が変わったら、1 秒の debounce をかけて先頭 100 件を保存する。既読、削除、お気に入り、フィード削除など、どの操作で変わってもキャッシュが state とずれない。もっと読む（load more）で 100 件を超えた分は保存しない。
2. **起動時の復元（FeedsContext）**: ユーザーがいて `articles` が空のときに `loadArticleCache()` から復元し、`readArticles` も `isRead` から組み立てる。Home が呼ぶ `refreshAll()` は従来どおりで、取得できたら上書きされる。
3. **オフライン表示（Home）**
   - 取得に失敗して、キャッシュから表示しているときだけ、一覧の上に細いバナーを出す（「Offline — showing articles from 2h ago」）。
   - そのときはエラーのトーストを出さない。
   - オンラインかどうかは `expo-network` の `getNetworkStateAsync()` で判定する。判定が取れなくても、取得が失敗しただけでバナーは出す。
   - 次に取得が成功したらバナーを消す。
4. **オフライン時の既読**: 今回はキューを作らない。オフラインで既読にした操作は、いまと同じく失敗してトーストが出る。既読キューは BRUSHUP #8 の Phase 2 として残す。
5. **サインアウトとデータ削除**: `UserContext.signOut` と Profile の Clear All Data（`resetAll()`）で `clearArticleCache()` を呼ぶ。
6. **バックグラウンド先読み（backgroundRefresh.js）**
   - `fetchNewArticles()` が取った未読一覧を、`found` だけでなくそのまま返すように変える。
   - `runBackgroundRefresh()` で、取得できたら `mergeIntoArticleCache()` を呼ぶ。
   - `mergeIntoArticleCache()` は、キャッシュがあってログイン中のユーザーと一致するときだけ動く。`id` が同じ記事は上書き、無い記事は追加して `publishedAt` の降順に並べ直し、100 件に切る。キャッシュが無ければ何もしない（既読の記事が混ざっていない一覧を新しいキャッシュにしないため）。
   - 時間切れで一覧を取らなかった実行（`listSkipped: 'slow'`）では先読みもしない。iOS の 30 秒制限への対策は今のままで足りる。
   - Recent Runs のログに `prefetched: n` を残す。
   - Check Now（`foreground: true`）でも同じように保存してよい。

**検証**
- 機内モードで起動し、前回の一覧とバナーが出ること。機内モードを切って引っ張って更新し、バナーが消えること。
- 既読にしてからアプリを終了し、機内モードで起動すると既読のまま出ること。
- サインアウトして別のアカウントでサインインし、前のアカウントの記事が出ないこと。
- バックグラウンド実行のあと機内モードで開き、その実行で取れた新着が一覧に出ていること。Recent Runs に `prefetched` が残っていること。

---

## D. キーワードに一致した記事の強調表示（新規）

**位置づけ**: 1.0.16 で入れたキーワード通知（#27 の 27d）のキーワードを、記事一覧の強調表示にも使う。記事を隠さないので、#20 キーワードミュートを却下した理由には当たらない。BRUSHUP の判断記録にある「キーワード一致を見逃す問題が出たら、一致記事に印を付ける」案を先に入れる形になる。

**仕様**
- 対象はモバイルの Home の記事一覧だけ。Web には出さない（キーワードが端末ローカルにしか無いため）。
- 照合には `apps/mobile/src/utils/newArticleNotifications.js` の `matchKeyword()` をそのまま使う（NFKC 正規化と大文字小文字無視、タイトルだけを見る）。通知と強調で一致の判定がずれないようにするため。
- フィードごとの通知オフ（`mutedFeedIds`）は無視して強調する。オフにしているのは通知だけなので。
- 既読の記事も強調する。ただし既読の記事は全体が薄く表示されるので、強調も一緒に薄くなる。
- 見た目:
  - カードの左端に primary 色の細い帯（3pt）を付ける。
  - メタ行（フィード名の行）の右端に、一致したキーワードを小さなチップで出す。複数一致したら最初の 1 つ。
- 「Keyword」フィルタは足さない。13 mini ではフィルタバーに余裕が無いため。見逃しが実際に問題になったら検討する。

**変更**
1. `apps/mobile/src/scenes/home/Home.js`
   - `loadBgSettings()` から `keywords` を読み、state に持つ。読み直すのは画面にフォーカスが戻ったとき（`useFocusEffect`。設定画面から戻ったときに反映するため）。
   - `useMemo` で記事 id からキーワードへの Map を作る。依存は `articles` と `keywords`。
   - `renderArticle` で Map を見て、帯とチップを付ける。
   - キーワードが 0 件なら Map を作らない。
2. 設定画面（Background Refresh のキーワード欄）の説明文に「一致した記事は一覧でも強調されます」を足す。

**検証**: キーワードを登録して Home に戻ると、該当記事に帯とチップが付くこと。全角と半角、大文字と小文字の違いでも一致すること。キーワードを消して戻ると強調が消えること。キーワードが無いときに一覧のスクロールが重くならないこと。

---

## E. サイト URL からのフィード自動発見（#18）

親計画の #18 節にある手順どおりに進める。2026-11-24 のコード確認で分かった補足だけここに書く。

**補足**
- **重複の確認**: 重複フィードは今、insert したときの unique 制約違反（`23505`）で弾いている。発見した URL で insert すれば同じ仕組みで弾けるので、別に確認する処理は要らない。エラー文は「Feed already exists」のままでよい。
- **ファビコン**: `extractFaviconUrl(url)` はホスト名から作っている。発見した URL が別ドメイン（例: feeds.feedburner.com）のこともあるので、**発見した場合は元のサイト URL からファビコンを作る**。
- **取得処理の切り出し**: `onRequestPost` 内の fetch（10 秒タイムアウト、User-Agent `FeedOwn/1.0 (RSS Reader)`）、`looksLikeFeed`、`hasFeedItems` を `fetchAndValidateFeed()` にまとめる。発見した URL の再取得で使い回すため。
- **テストは本番に対して走る**: `functions/test/api.spec.ts` は `https://feedown.pages.dev`（`API_BASE_URL`）に実際にリクエストする統合テストで、fetch のモックは無い。そのため次のようにする。
  - 新しいテストは**デプロイしてから**流す。
  - テスト用の HTML には、構成が変わりにくい公開サイトを使う（例: `https://github.blog/`、`<link rel="alternate" type="application/rss+xml">` がある）。
  - 相対 href の解決と、発見先がまた HTML だった場合の 2 つは、外部サイトに頼るとテストが不安定になる。`discoverFeedUrl(html, pageUrl)` を export して、純粋関数として単体テストする（文字列の HTML を渡すだけ）。
- **OPML の取り込み**: 同じ POST を通るので、OPML に入っているサイト URL も自動で発見されるようになる。害はないので、そのままにする。
- **UI**
  - Web `FeedsPage.jsx` の `handleAddFeed`（118 行目付近）: `response.data.discoveredFrom` があれば、トーストを「Found a feed on this site and added it」に変える。入力欄のヒントに「Site URLs work too」を足す。
  - Mobile `FeedsContext.addFeed` は `{ success, feed }` を返している。ここに `discoveredFrom` を足し、`Read.js` 側でトーストを出し分ける。
- `docs/API.md` に `discoveredFrom` と、HTML を渡したときの挙動を書き足す。

---

## 実装順とリリース

**実装順**: E → B → A → D → C
- E（#18）はサーバーが中心で、デプロイしないとテストできないので最初にやる。
- B と A は小さく、他と干渉しない。
- D は Home の `renderArticle` を触る。C も Home にバナーを足すので、Home の変更は D、C の順にまとめる。
- C がいちばん大きいので最後にやる。

**コミット**: 項目ごとに 1 コミットにする（`feat(functions): discover feeds from site URLs`、`feat(mobile): cache the article list for offline use` など）。直接 main に積んでよい。

**リリース**
1. functions と Web: E と B の Web 部分ができたら、`yarn build:web` のあとルートから `npx wrangler pages deploy`（パス引数なし）。そのあと `api.spec.ts` を流す。
2. モバイル: A〜E のモバイル部分を全部入れてから、**1.0.17 としてストアに提出する**（2026-11-24 決定。JS だけの変更なので OTA でも出せるが、OTA にはしない）。`apps/mobile/app.json` の `version` を 1.0.17、iOS `buildNumber` を 23、Android `versionCode` を 18 に上げる（1.0.16 は 22 / 17）。ビルドと提出の前にユーザーに確認する。
3. 完了したら、`BRUSHUP_PLAN.md` の #4 / #8（Phase 1 部分）/ #14 / #18 に ✅ を付け、D を判断記録に書く。#27 の ✅ も付け忘れているので、そのとき一緒に直す。

**この計画に入れないもの**
- オフライン時の既読キュー（#8 Phase 2）
- キーワードの Web 同期
- 「Keyword」フィルタ
- 死んだフィードの通知
