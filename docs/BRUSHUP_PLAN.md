# FeedOwn ブラッシュアップ計画

**作成日**: 2026-07-05
**目的**: リリース済みの FeedOwn を、信頼性・UX・コード品質の面で底上げする。各項目は独立して実装・リリース可能。実装セッションはこのドキュメントの該当項目だけ読めば着手できるように書いてある。

## 実装セッションへの前提知識

- モノレポ構成: `apps/web` (Vite+React, JSX+インラインスタイル), `apps/mobile` (Expo+RN), `functions/` (Cloudflare Pages Functions = API), `workers/` (RSS プロキシ、現在未使用), `packages/shared`。DB は Supabase PostgreSQL。
- スキーマと設計は `docs/DESIGN.md`、API 仕様は `docs/API.md`、過去の機能計画は `docs/FEATURE_PLAN.md` を参照。
- **デプロイ**: ルートから `npx wrangler pages deploy`(パス引数なし)。`wrangler.toml` の `pages_build_output_dir` が効く。パス引数を付けると `functions/` が除外されて全 API が 405 になる（既知の事故）。
- セルフホスト前提のプロダクト。SignIn/SignUp の Server URL placeholder は `feedown.pages.dev` のままにする（セルフホスターが自分の URL を入れる UX）。
- 無料枠運用が設計思想（Supabase 500MB / Cloudflare Workers 10万req/日 / KV write 1,000/日）。無料枠を食いつぶす実装は不可。
- モバイルは App Store / Google Play 公開済み。ネイティブ依存を追加する変更は EAS ビルド+審査が必要になるので、JS だけで済む実装を優先する。
- モバイルのオンデバイス AI(`apps/mobile/src/ai/`) は `docs/MOBILE_ON_DEVICE_AI_PLAN.md` の Phase 1〜6 まで実装済み（視点切り替え要約・信号分離・記事チャット・要約読み上げ TTS・本文翻訳 Hy-MT2 がモバイル 1.0.13 で出荷済み）。残課題は本計画の **Track F** で扱う。詳細仕様は同計画書を一次資料とする。

---

## 優先度サマリー

| # | 項目 | Track | 優先度 | 規模 | 対象 |
|---|------|-------|--------|------|------|
| 1 | 期限切れ記事のクリーンアップ | A: 信頼性 | **P1** | 小 | functions, docs |
| 2 | バックグラウンド自動更新 (Cron) | A: 信頼性 | **P1** | 中 | workers, functions |
| 3 | CI (GitHub Actions) | A: 信頼性 | **P1** | 小 | .github |
| 4 | フィード取得エラーの可視化 | A: 信頼性 | **P1** | 小 | functions, web, mobile |
| 5 | Web リーダーモード | B: Web UX | P2 | 中 | web |
| 6 | 記事検索 | B: Web UX | P2 | 中 | functions, web, mobile |
| 7 | 未読件数バッジ | B: Web UX | P2 | 小 | functions, web, mobile |
| 8 | モバイル オフラインキャッシュ | C: Mobile UX | P2 | 中 | mobile |
| 9 | axios 等の依存更新 | D: コード品質 | P2 | 小 | mobile |
| 10 | Web キーボードショートカット | B: Web UX | P3 | 小 | web |
| 11 | Web 巨大ページの分割 | D: コード品質 | P3 | 中 | web |
| 12 | Redux スタック整理 | D: コード品質 | P3 | 中 | mobile |
| 13 | README / ドキュメント同期 | E: docs | P3 | 小 | docs, README |
| 14 | aiCache の 7日 TTL / eviction | F: AI | **P1** | 小 | mobile |
| 15 | バックグラウンド先回り要約 | F: AI | P2 | 大 | mobile |
| 16 | 本文読み上げ (Reader Mode TTS) | F: AI | P3 | 中 | mobile |
| 17 | 意味検索 (embedding) | F: AI | P3 | 大 | mobile |

実装順の推奨: 1 → 3 → 2 → 4 → 14 (P1 を先に固める) → 以降は任意の順。ただし 15 は 14 完了が前提。

---

## Track A: 信頼性・運用

### 1. 期限切れ記事のクリーンアップ 【P1・小】

**問題**: `articles` テーブルは `expires_at`(取得から7日) を持ち、読み取り時に `.gt('expires_at', now)` でフィルタしているだけ（`functions/api/articles/index.ts:80`）。**期限切れ行を DELETE する処理がコードベースのどこにも存在しない**。記事は無限に蓄積し、Supabase 無料枠 500MB をいずれ圧迫する。

**実装方針**（両方やる）:

1. **`/api/refresh` に便乗削除**: `functions/api/refresh.ts` のリフレッシュ処理の最初か最後に、そのユーザーの期限切れ記事を削除する。
   ```ts
   await supabase.from('articles')
     .delete()
     .eq('user_id', userId)
     .lt('expires_at', new Date().toISOString());
   ```
   `read_articles` の孤児行（削除された記事の既読レコード）も削除できるとなお良いが、`read_articles.article_id` に FK が無いので JOIN 削除が必要。RPC(ストアド関数)を1本追加して `docs/SUPABASE_SETUP.md` に SQL を追記するのが素直。難しければ Phase 2 でよい。
2. **セルフホスター向けに pg_cron を文書化**: `docs/SUPABASE_SETUP.md` に pg_cron で日次 `DELETE FROM articles WHERE expires_at < NOW()` を仕込む手順を追記（Supabase は pg_cron 拡張をサポート）。

**検証**: ローカルで期限切れレコードを作り、`/api/refresh` 呼び出し後に消えていること。既存テスト `functions/test/api.spec.ts` にケース追加。

### 2. バックグラウンド自動更新 (Cron Trigger) 【P1・中】

**問題**: ユーザーが手動リフレッシュしない限りフィードが更新されない。アプリを開いてから待たされる。

**既存計画あり**: `docs/FEATURE_PLAN.md` の「4. バックグラウンド自動更新」に方法A(専用 Cron Worker)/方法B(GitHub Actions) の詳細計画が既にある。**方法A（Cloudflare Worker + Cron Trigger、6時間ごと）を採用**する。

**補足方針**:
- 新規 Worker `workers/cron-refresh/` を作る。Pages Functions は Cron 非対応。
- Worker から `POST /api/cron/refresh`（新規、`CRON_SECRET` Bearer 認証）を叩く形にすると、リフレッシュロジックを `functions/api/refresh.ts` と共有しやすい。全ユーザーを一括処理し、Supabase 同時接続 60 を超えないよう直列〜小バッチ（例: 5ユーザーずつ `Promise.allSettled`）で回す。
- 直近コミット `39b9220` で `/api/refresh` にレート制限が入っている。cron 経路がこのレート制限に食われない/悪用されないことを確認する。
- #1 のクリーンアップをこの cron に組み込むと一石二鳥。
- セルフホスターも同じ構成を再現できるよう `docs/SETUP.md` にデプロイ手順（`wrangler deploy` + secrets 設定）を追記。

**検証**: `wrangler dev --test-scheduled` で scheduled イベントを発火し、記事が更新されること。誤った `CRON_SECRET` で 401 になること。

### 3. CI (GitHub Actions) 【P1・小】

**問題**: `.github/workflows` が存在しない。lint もテストも手元頼み。

**実装方針**: `.github/workflows/ci.yml` を新規作成。push / PR で:
- `yarn install --frozen-lockfile`
- `yarn workspace web lint` と `yarn workspace web build`
- `cd functions && npm test`（Vitest）
- `cd workers && npm test`（Vitest + vitest-pool-workers）
- Playwright E2E はライブ環境依存なので CI には入れない（または手動トリガーの別 workflow）。
- mobile は `jest --passWithNoTests` なので当面 lint のみで可。

**検証**: PR を切って CI が緑になること。わざと lint エラーを入れて赤になること。

### 4. フィード取得エラーの可視化 【P1・小】

**問題**: `feeds` テーブルに `error_count` / `last_success_at` があるが、UI でユーザーに見せていない。死んだフィードに気づけない。

**実装方針**:
- `functions/api/refresh.ts` が取得失敗時に `error_count` をインクリメントし成功時に 0 リセットしていることを確認（していなければ実装）。
- `GET /api/feeds` のレスポンスに `errorCount` / `lastSuccessAt` を含める。
- Web `apps/web/src/pages/FeedsPage.jsx`: `error_count >= 3` のフィードに警告バッジ（⚠ + 「最終成功: n日前」ツールチップ）。
- Mobile `apps/mobile/src/scenes/read/Read.js`: 同様のバッジ。
- 直近で `POST /api/feeds` に URL バリデーション（HTML 拒否・item なし拒否, commit `5c6119a`/`aed0b06`）が入った。追加時は弾けるが、追加後に死んだフィードはこの項目でしか気づけない。

**検証**: 存在しない URL のフィードを DB に直接作り、リフレッシュ後に UI にバッジが出ること。

---

## Track B: Web UX

### 5. Web リーダーモード 【P2・中】

**問題**: 記事本文抽出 API `functions/api/article-content.ts`（linkedom + @mozilla/readability）は**モバイル専用**で、Web からは一切使われていない（`apps/web/src` に参照なし）。Web ユーザーは元サイトに飛ぶしかない。

**実装方針**:
- `apps/web/src/components/ArticleModal.jsx` に「Reader Mode」ボタンを追加。押下で `/api/article-content?url=...` を呼び、抽出 HTML をモーダル内に表示。
- サニタイズ必須: API が返す HTML をそのまま `dangerouslySetInnerHTML` に入れない。`DOMPurify` を `apps/web` に追加して通す。
- ダークモード対応（既存の ThemeContext/スタイル慣行に合わせる）。
- ローディング/抽出失敗時のフォールバック表示（「元記事を開く」誘導）。

**検証**: 数種類のサイト（日本語ニュース、英語ブログ、画像多め）で表示確認。script タグ入り HTML が無害化されること。

### 6. 記事検索 【P2・中】

**問題**: 記事はタイトル/概要を持つのに検索手段がない。7日分の記事でも量が多いユーザーには不便。

**実装方針**:
- API: `GET /api/articles` に `q` パラメータを追加。`functions/api/articles/index.ts` で `.or('title.ilike.%q%,description.ilike.%q%')` を追加（Supabase クエリビルダーの `or` + `ilike`。`q` のエスケープに注意: `%` `,` `(` `)` を除去またはエスケープ）。7日 TTL でデータ量が小さいので ilike で十分、全文検索インデックスは不要。
- Web: `DashboardPage.jsx` のヘッダーに検索ボックス（デバウンス 300ms、クリアボタン付き）。既存の `feedId` フィルタと併用可能に。
- Mobile: `Home.js` ヘッダーに検索アイコン → 検索バー展開。`FeedsContext.fetchArticles` に `q` を渡す。
- `docs/API.md` にパラメータ追記。

**検証**: 日本語・英語キーワードでヒットすること。`%` や `'` を含む入力でエラーにならないこと。

### 7. 未読件数バッジ 【P2・小】

**問題**: 未読が何件あるか、どのフィードに未読が溜まっているか分からない。

**実装方針**:
- API: `GET /api/feeds` のレスポンスに `unreadCount` を追加。Supabase RPC（1本の SQL: articles LEFT JOIN read_articles を feed_id で GROUP BY）にして N+1 を避ける。RPC の SQL は `docs/SUPABASE_SETUP.md` に追記。
- Web: フィード選択ドロップダウンとフィード管理ページに件数表示。全体未読数をタブタイトル（`document.title = '(12) FeedOwn'`）にも反映。
- Mobile: フィードドロップダウンの各行に件数表示。
- パフォーマンス注意: 記事一覧取得のたびに数えない。フィード一覧取得時のみ。

**検証**: 記事を既読にすると件数が減ること。フィード削除時に整合すること。

### 10. Web キーボードショートカット 【P3・小】

j/k: 記事移動、Enter/o: 詳細を開く、m: 既読トグル、s: お気に入り、r: リフレッシュ、/: 検索フォーカス。`DashboardPage.jsx` に `useEffect` で keydown リスナー（input フォーカス中は無効）。`?` でショートカット一覧モーダル。RSS リーダーの古参ユーザー（このプロダクトのターゲット）には定番機能。

---

## Track C: Mobile UX

### 8. モバイル オフラインキャッシュ 【P2・中】

**問題**: `docs/PROGRESS.md` の「将来の機能追加」に残っている未実装項目。電波のない環境で記事一覧すら見られない。

**実装方針**:
- 最後に取得した記事一覧（50〜100件）を AsyncStorage にキャッシュ。`FeedsContext.js` の `fetchArticles` 成功時に保存、起動時にネットワーク失敗したらキャッシュから復元し「オフライン表示」バナーを出す。
- `expo-network`（導入済み）で接続状態を判定。
- 既読操作はオフライン時キューに積み、復帰時に `batch-read` へ flush（規模が膨らむならこのキューは Phase 2 に切り出してよい。まず読み取りキャッシュだけで価値がある）。
- リーダーモード本文のキャッシュは対象外（サイズが読めないため）。
- 新規ネイティブ依存なし（AsyncStorage 既存）なので OTA/JS 更新のみで出せる。

**検証**: 機内モードで起動し、直前の記事一覧が表示されること。復帰後に通常動作へ戻ること。

---

## Track D: コード品質・依存関係

### 9. 依存関係の更新 【P2・小】

- **`axios ^0.21.2` (mobile)**: 古すぎる。0.21.x には既知 CVE（SSRF 等）があり、現行は 1.x。`apps/mobile/src/utils/api.js` ほか使用箇所の breaking change（エラーハンドリング、`AxiosError`）を確認して 1.x へ。使用箇所が薄ければ fetch への置き換えも可。
- **確認のみ**: `moment`（重いが動いている。置換は任意）、`react-native-tab-view ^3.x`（RN 0.83 との整合）。
- **この項目では触らない**: `llama.rn 0.12.4` と `react-native-executorch 0.9.1`。これらは AI 基盤の依存で、モバイル 1.0.14 リリースに紐づくバンプ計画がある（Track F 冒頭の注記を参照）。
- 更新後は EAS ビルドが必要な変更か（ネイティブ側に触れるか）を必ず判定し、コミットメッセージに明記。

### 11. Web 巨大ページの分割 【P3・中】

`DashboardPage.jsx` 890行 / `FeedsPage.jsx` 709行 / `SetupGuidePage.jsx` 876行。すべてインラインスタイル + 単一ファイル。

- `DashboardPage` から `ArticleCard`, `FeedFilterDropdown`, `ArticleList` を `components/` に抽出。
- スタイルは既存慣行（インラインスタイルオブジェクト）を維持したままファイル分割するだけでよい。CSS 化までは踏み込まない（デグレのリスクに見合わない）。
- **動作を変えない純リファクタ**であること。E2E（`apps/web/e2e/dashboard.spec.ts`）が通ることを完了条件にする。
- #5/#6/#7 の実装と競合するので、Track B の後にやるか、先にやってから Track B に入るか、どちらかに寄せる。

### 12. Redux スタック整理 【P3・中・要調査】

mobile に `@reduxjs/toolkit ^1.5.1` + `redux ^4` + `react-redux ^7` + `redux-logger` が入っているが、状態管理の主役は Context（`FeedsContext`, `UserContext`, `ThemeContext`）に見える。`apps/mobile/src/slices/` の実使用箇所を調査し:
- ほぼ未使用なら Redux 一式を撤去（ボイラープレート由来の残骸の可能性が高い）。
- 使っているなら RTK 2.x / react-redux 9.x へ更新。
判断がつかない場合は調査結果をこのファイルに追記して撤退してよい。

---

## Track E: ドキュメント

### 13. README / ドキュメント同期 【P3・小】

- `README.md` の Deploy 手順が `npx wrangler pages deploy apps/web/dist` になっている。**これはパス引数付きで functions が除外される誤り**。ルートから引数なし `npx wrangler pages deploy` に修正（`wrangler.toml` の `pages_build_output_dir` が使われる）。
- README の Features にオンデバイス AI 機能（要約・翻訳・TTS 等、モバイル 1.0.13 で出荷済み）の記載がない。追記。`README.ja.md` も同期。
- `docs/PROGRESS.md` が 2026-01-24 で止まっている。Phase 14 以降（AI 機能、1.0.9〜1.0.13 リリース）を追記するか、「以降は git log と MOBILE_ON_DEVICE_AI_PLAN.md を参照」と明記して凍結する。
- 本計画の項目を完了したら、このファイルの表に ✅ を付けること。

---

## Track F: オンデバイス AI（モバイル）

**現状**: `docs/MOBILE_ON_DEVICE_AI_PLAN.md` の Phase 1〜6 が実装・出荷済み。`apps/mobile/src/ai/` 配下に要約 (`useArticleAi.js`)・翻訳 (`useArticleTranslation.js`, Hy-MT2)・TTS (`ttsService.js`)・チャット・信号分離・ベンチマーク UI が揃っている。以下は同計画書に仕様が書かれた未実装分と将来拡張。**各項目の詳細仕様は MOBILE_ON_DEVICE_AI_PLAN.md が一次資料**であり、本書は優先度と着手順だけを定める。

**依存バンプの既定方針**（この Track の項目に着手する前に確認）:
- `react-native-executorch` 0.9.1 → 0.9.2 はモバイル 1.0.14 のタイミングで取り込む方針（caret 解決なので lockfile 更新のみ）。
- `llama.rn` 0.12.4 → 0.12.5（Gemma MTP 対応）へのバンプ予定あり。ネイティブ側が変わるため EAS ビルドが必要。
- どちらも「1.0.14 リリース作業」として Track F の実装と同じビルドに相乗りさせるとビルド・審査回数を節約できる。

### 14. aiCache の 7日 TTL / eviction 【P1・小】

**問題**: `apps/mobile/src/ai/aiCache.js` に削除ロジックが一切ない（TTL・eviction とも未実装。コード確認済み）。AI 出力キャッシュ（要約・翻訳）が AsyncStorage に無限蓄積し、容量超過時は `setItem` が静かに失敗して以降のキャッシュが効かなくなる。長期使用で確実に破綻する。

**実装方針**: MOBILE_ON_DEVICE_AI_PLAN.md「機能6 › 前提タスク: aiCache の 7 日 TTL 改修」の仕様どおり。
- `isRecordValid` に「`createdAt` から 7 日経過で無効」の lazy 失効を追加。
- `sweepExpiredCache()` を追加（`getAllKeys()` → prefix フィルタ → `multiRemove`）。
- AiContext の mount 時に 1 回 sweep を呼ぶ。
- サーバー側の記事 TTL 7 日（`functions/api/refresh.ts`）と揃える意図。Track A #1（サーバー側クリーンアップ）と対になる改修。
- JS のみの変更なので EAS ビルド不要。

**検証**: `createdAt` を 8 日前に偽装したキャッシュレコードが起動時 sweep で消えること。有効なレコードが残ること。

### 15. バックグラウンド先回り要約 【P2・大】

**内容**: アプリを開いていない間に未読記事の `brief` 要約を端末内 LLM で先回り生成する。MOBILE_ON_DEVICE_AI_PLAN.md「機能6: バックグラウンド先回り要約」に、実行予算・エラー戦略・AppState 遷移時の中断シーケンス・AiContext との競合制御・設定 UI・テスト戦略まで詳細仕様が完成している。**本書からは追加の設計指示はない**。同セクションを読んで着手すること。

**着手条件と注意**:
- #14（aiCache TTL）が完了していること（明示的な前提タスク）。
- `expo-background-task` の追加が必要 = ネイティブ変更 = EAS ビルド必須。上記の依存バンプ（executorch 0.9.2 / llama.rn 0.12.5）と同じ 1.0.14 ビルドに相乗りさせるのが効率的。
- iOS の `BGProcessingTask` は実行タイミングが OS 任せで、実機でしか検証できない。計画書の「テスト戦略」「観測性 / 実行履歴」節に従い、Profile 画面の実行履歴表示を必ず先に入れる（これがないと実機デバッグ不能）。
- App Store 審査でバックグラウンド処理の用途説明を求められる可能性がある。過去に 2.5.4（バックグラウンドオーディオ）でリジェクト経験があるため、審査ノートに用途（端末内 AI 処理、通信は自社 API 2 本のみ）を明記する。

### 16. 本文読み上げ (Reader Mode TTS) 【P3・中】

**内容**: 現在の読み上げは要約のみ（`ArticleReadAloudControls.js` は `summaryToSpeakableText` を使用）。MOBILE_ON_DEVICE_AI_PLAN.md「Phase 7: 本文読み上げ検討」のとおり、Reader Mode 本文の段落単位読み上げに拡張する。

**方針**: 段落分割・一時停止/再開・前後の段落スキップ・読み上げ位置管理。まずはアプリ表示中の再生に限定し、ロック画面操作・バックグラウンド再生はやらない（App Store 2.5.4 リジェクトの再発回避。`enableBackgroundPlayback: false` を維持する）。JS のみで実装可能なはず（expo-audio は導入済み）だが、着手時に確認すること。

### 17. 意味検索 (embedding) 【P3・大・要ユーザー判断】

**内容**: MOBILE_ON_DEVICE_AI_PLAN.md「将来拡張 › 意味検索」。記事の embedding を端末内で生成・SQLite に保存し、保存済み記事を自然文で検索する。計画書自身が「LLM チャットより RSS リーダーとしての価値が高い可能性」と評価している。

**注意**:
- Track B #6（キーワード検索）とは別物。#6 はサーバー側 ilike の軽い機能で先に出す。意味検索はその後、検索 UI を共有する形で載せる。
- embedding モデルの選定（executorch の text embedding 対応状況）、生成コスト、インデックス方式の調査が先。**まず調査スパイクを 1 セッション実施し、結果をこのファイルと MOBILE_ON_DEVICE_AI_PLAN.md に追記してから実装判断**とする。
- 関連記事チャット（Phase 8）と音声ダイジェストは、意味検索の基盤（embedding + SQLite）ができてから再評価。本計画では対象外。

---

## 実装セッション向け共通ルール

1. 1項目 = 1ブランチ = 1PR 相当の粒度でコミットする。コミットメッセージは既存の慣行（`fix(functions): ...` / `feat(web): ...`）に従う。
2. API を変えたら `docs/API.md` を、スキーマ/RPC を足したら `docs/SUPABASE_SETUP.md` を同時に更新する。
3. functions のテスト(`functions/test/api.spec.ts`)、web の E2E がある領域を触ったらテストも更新する。
4. デプロイはルートから `npx wrangler pages deploy`（パス引数なし）。
5. Track F の項目を実装したら `docs/MOBILE_ON_DEVICE_AI_PLAN.md` の該当フェーズ/進捗節も更新する（同計画書の「ドキュメント更新ルール」に従う）。
6. 応答は簡潔に。編集後の長いまとめは不要（ユーザーの好み）。
