# 1 年前の Cloudflare の国別ブロックに App Store で 5 連続リジェクトされた話

*5 連敗 + 4 つの誤診を経て、真因を炙り出した GraphQL クエリの記録*

---

> **状態 (2026-05-16)**: 5 連続リジェクトの末、真因を特定して修正を入れた。新 build は不要だったので、既存 build (1.0.7, build 11) のまま Resolution Center で再審査を依頼済み。本記事は誤診も含めた調査の全体を残したもの。「実際に通ったかどうか」は承認後に追記する。

---

## Apple から届いたもの

最初のリジェクトは **Guideline 2.1(a) — Performance — App Completeness**。App Review からの本文 (原文):

> **Issue Description**
>
> The app exhibited one or more bugs that would negatively impact users.
>
> Bug description: Specifically, we were unable to log in with the provided information due to an error.
>
> **Review device details:**
>
> - Device type: iPhone 17 Pro Max and iPad Air 11-inch (M3)
> - OS version: iOS 26.4.2 and iPadOS 26.4.2
> - Internet Connection: Active
>
> **Next Steps**
>
> Test the app on supported devices to identify and resolve bugs and stability issues before submitting for review.

要約: 「提供された認証情報でログインできなかった」「テスト機種は iPhone 17 Pro Max と iPad Air 11" (M3)、OS は iOS / iPadOS 26.4.2」「ネット接続は有効」。

そして添付されていたのはスクリーンショット 1 枚:

![レビュアーのスクリーンショット: Sign In Failed — JSON Parse error: Unexpected character: <](apple-review-jsonparse-error.png)
*1 回目のリジェクト時 (2026-05-10) にレビュアーが送ってきたスクリーンショット。Server URL は `https://feedown.pages.dev`、トーストには React Native の生エラー `JSON Parse error: Unexpected character: <` がそのまま出ている = `JSON.parse()` に `<` で始まる何か (= ほぼ確実に HTML) が渡されている。*

これだけ。スタックトレースもネットワークログも、リクエストがどう見えたかの情報も無い。「お前のアプリは俺たちの網ではサインインが壊れてる」という事実だけ。

問題は **手元の他の環境では全部動いていた** こと。自分の全端末。TestFlight。友人の端末。ブラウザタブ。サーバは全リクエストに正しい JSON を返していた。

しかも **過去 4 回の App Store 審査ではこの認証フローは問題なく通っていた**。同じバックエンド、同じクライアントコード、同じ Sign In 画面で、4 回連続で承認されてきた実績がある。今回の submit では auth 周りに変更を加えていないし、レビュアー側の (見える範囲の) 変化も無い。それなのに、このラウンド以降は同じフローが安定的に `JSON Parse error` を踏み続けて、Apple は連続でリジェクトしてきた。

本記事は、真因に辿り着くまでに 5 回リジェクトされた話、その途中の 4 つの誤診、そして 1 年間目の前に放置されていたものを最後に炙り出した GraphQL クエリの物語。

---

## 構成

[FeedOwn](https://github.com/kiyohken2000/feedown) というセルフホスト型の RSS リーダーを作っている。モバイルは React Native (Expo)、バックエンドは Cloudflare Pages。認証層は Supabase の薄いラッパーで、`functions/api/auth/login.ts` などにある:

```ts
// functions/api/auth/login.ts (元のバージョン)
export async function onRequestPost(context) {
  const { email, password } = await context.request.json()
  const result = await supabase.auth.signInWithPassword({ email, password })
  return new Response(JSON.stringify(result), {
    headers: { 'content-type': 'application/json' }
  })
}
```

問題なく見える。手元の全端末で動く。シミュレータでも動く。TestFlight でも動く。友人の端末でも動く。

**Apple のレビュー網だけで動かない**。

## 1 回目: 「JSON Parse error: Unexpected character: <」

最初のリジェクトのスクリーンショット (本記事冒頭に貼ったもの) は React Native ではあるあるの症状。`fetch().then(r => r.json())` に `<` で始まる何かが渡されている = ほぼ確実に HTML。レビュアーの環境では JSON ではなく HTML ページが返ってきていた。

**でも、なぜ?** 本番は動く。TestFlight も動く。エンドポイントは `https://feedown.pages.dev/api/auth/login`。最初は CDN キャッシュの一時的な問題だと思った。`Cache-Control: no-store` を付けて、防御的な JSON パーサーを足した:

```js
async function safeReadJsonResponse(response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(
      `The server didn't return a valid response (HTTP ${response.status})`
    )
  }
}
```

再 submit。自信あり。外れ。

## 2 回目: 「feedown.org」でも同じ

`pages.dev` ドメインがレビュー網でフィルタされてるのかも、と考えてカスタムドメイン `feedown.org` を Cloudflare proxied で割り当て。再 submit。

同じリジェクト。同じトースト。違うドメイン。

ここから横道に入り始める。Supabase が原因では? 地域ブロックでは? iOS 26.5 の `URLSession` が何かしてる?

## 3 回目: DNS only バイパス

Cloudflare のプロキシが何かチャレンジページを差し込んでるなら、Cloudflare ゾーン自体を迂回すればいい。`api.feedown.org` を作って、DNS レコードを **DNS only (灰色の雲)** にして Pages を指す。アプリのエンドポイントを `https://api.feedown.org` に変更。

トラフィックは `Apple → DNS → Pages` に。間に Cloudflare ゾーンは挟まらない。**これで** 通るはず。

同じリジェクト。Quick Create ボタン (テストアカウントを内部生成、レビュアーの入力に依存しない) も失敗。

![api.feedown.org で Sign In Failed](apple-review-signin-failed.png)
![api.feedown.org で Quick Create Failed](apple-review-quickcreate-failed.png)
*この 2 枚は後のラウンドで送られてきたもの。`https://api.feedown.org` (DNS only バイパス) に切り替え、クライアント側のエラーメッセージも「The server didn't return a valid response (HTTP…)」に変更した後の状態。注目点 2 つ: (1) Server URL 欄が `api.feedown.org` になっている = Cloudflare ゾーンを経由していない、(2) Quick Create (ランダムなテストメールを内部生成して同じエンドポイントを叩くだけ) も Sign In と同じように失敗 = レビュアーの入力に依存しないコードパスでも同症状 = ネットワーク経路そのものが原因。*

3 回目で安易な仮説が尽きた。

## 4 回目: ログを見に行く (そして誤った結論に飛びつく)

新しい Cloudflare API トークン (Analytics 権限付き) を発行して、レビューウィンドウ (タイムスタンプは App Store Connect のレビューステータスから取れる) で GraphQL Analytics を叩いた:

```graphql
query ReviewWindow($zoneTag: string!, $start: Time!, $end: Time!) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      httpRequestsAdaptiveGroups(
        filter: {
          datetime_geq: $start,
          datetime_leq: $end,
          clientRequestPath_like: "/api/auth/%"
        },
        limit: 1000
      ) {
        dimensions {
          clientRequestHTTPMethodName
          clientRequestPath
          edgeResponseStatus
        }
        count
      }
    }
  }
}
```

レビューウィンドウ内の結果: **`/api/auth/*` POST がゼロ件**。何も。400 も 500 も無く、純粋に何も無い。

= `api.feedown.org` の DNS only バイパスは正しく機能している (機能していなければゾーン分析に出るはず)。トラフィックは Pages に直行して、ゾーンログから見えない場所で死んでいる。

そこで原始的に curl を叩いた:

```bash
$ curl -i https://api.feedown.org/api/auth/login
HTTP/2 200
content-type: text/html; charset=utf-8

<!doctype html><html lang="en">...
```

POST エンドポイントに `GET` を投げると **`200 OK` と `text/html`** が返ってくる。405 ではない。404 でもない。React アプリの `index.html` が 200 で返ってくる。

ここで自分は煙の出ている銃を見つけたと思った。— が、結果的にこれが 1 回ぶん余計なリジェクトを呼ぶ誤診の入り口だった。

### (間違っていた) SPA フォールバック仮説

Cloudflare Pages には 2 つのレイヤがある:

1. `functions/` ディレクトリの **Functions** が動的ルートを処理
2. **静的アセット** + マッチしないルート向けの **`index.html` への SPA フォールバック**

`onRequestPost` を export すると、その Function は **POST しか** 処理しない。**他の method はそもそも Function に到達しない** — そのまま静的アセット層に落ちて、`/api/auth/login` という名前のファイルは存在しないので、SPA フォールバックが効いて `index.html` が `200 OK` で返る。

自分はこう推測した: Apple のレビュー網のどこかで、何かが POST を別 method に書き換えている。TLS 透過プロキシ? HTTP/2 ダウングレード? iOS URLSession の特定挙動? いずれにしても、リクエストは Cloudflare に POST 以外として到着し、SPA フォールバックに落ちて、HTML 200 が返って、モバイルクライアントが JSON として parse して失敗していると。

このストーリーは **手持ちの証拠と整合した**:
- レビュアーが見たのは HTML を JSON として parse した時の典型エラー
- curl で実際に非 POST が HTML 200 を返すことを確認
- ゾーン分析に `/api/auth/*` POST がゼロ件 (= 「POST として届いていない」と解釈した)

問題は、**同じ証拠に整合する別の仮説を見落としていた** こと。後でその別仮説の方がはるかにフィットすると気づいたが、それは 5 回目のリジェクト後の話。

### shipped した「修正」(真因への対応ではないが、それ自体は良い修正)

`onRequestPost` を `onRequest` に置き換えて、ハンドラ内で例外が出ても **絶対に JSON を返す** `withJsonGuard` ヘルパーを足した:

```ts
// functions/api/auth/login.ts (修正後)
import { withJsonGuard, methodNotAllowed, jsonResponse } from '../../lib/jsonResponse'

export async function onRequest(context) {
  const { request } = context
  return withJsonGuard('auth/login', request, async () => {
    if (request.method !== 'POST') {
      return methodNotAllowed(request.method, ['POST'])
    }
    return handlePost(context)
  })
}
```

```ts
// functions/lib/jsonResponse.ts
export async function withJsonGuard(label, request, handler) {
  logRequestDiag(label, request)
  try {
    return await handler()
  } catch (e) {
    console.error(`[${label}] unhandled`, e)
    return jsonResponse({ error: 'Internal error', label }, 500)
  }
}
```

クライアント側のエラーメッセージも締めて、トーストが切り詰められても診断情報が読めるようにした:

```js
throw new Error(
  `Unexpected ${shortContentType(ct)} response (HTTP ${status} ${method}). Please retry.`
)
// → "Unexpected html response (HTTP 403 POST). Please retry."
```

念のため言っておくと、この修正自体は本当に良い修正だ。**別の独立したバグ** (どんな呼び元でも非 POST を投げれば HTML 200 が返ってくる状態) を塞いでいる。`withJsonGuard` も、締めたエラーフォーマットも、後述する 5 回目のリジェクトで決定的な役に立つ。ただ、Apple が踏んでいた症状の直接の原因ではなかった、というだけの話。

## 5 回目のリジェクト: 同じ症状、より良いエラーメッセージ

SPA フォールバック対応を入れて submit。再び自信あり。再び外れ。

![5 回目のリジェクト: Sign In Failed — Unexpected html response (HTTP 403 POST)](apple-review-403-post.png)
*5 回目のリジェクト (2026-05-16) のスクリーンショット。Server URL は引き続き `https://api.feedown.org`、ただしトーストは今回入れた短縮フォーマット `Unexpected html response (HTTP 403 POST)` になっている。注目点 3 つ: (1) method は **`POST`** ← 4 回目で立てた「POST が別 method に書き換えられている」仮説は構造的に外れていた、(2) status は **`403`** ← 何かが能動的にリクエストを蹴っている、SPA フォールバック (200) ではない、(3) content は **`html`** ← ほぼ確実に Cloudflare の challenge interstitial。*

このスクリーンショット 1 枚で post-mortem の半分が終わっている。

4 回目の仮説 (SPA フォールバック) は「リクエストが POST 以外として届く」と **予言** していた。新エラーは **POST POST POST**、ステータス **403**。SPA フォールバックは 200 を返す、403 ではない。だから前仮説は不完全どころか構造的に間違っていた。

何かが `api.feedown.org/api/auth/login` への **POST** に対して 403 HTML を能動的に返している。Apple のネットワークからだけ、限定的に。

## ログを見直す (今度こそ正しい目で)

4 回目で見落としていたこと: **`api.feedown.org` が grey-cloud のとき、リクエストは zone analytics に出ないが、user-scope ルールは依然として発火する**。「zone analytics に `/api/auth/*` がゼロ件」は「Cloudflare のどのレイヤもこのリクエストを触っていない」ではなく、「**zone proxy が見ていない**」というだけ。Cloudflare には他のレイヤもある。

`api.feedown.org` を orange-cloud に戻して、以後のリクエストが少なくとも zone analytics に乗るようにした。それから **過去のラウンド** に遡って — 特に Round 2/3、demo server URL がまだ `feedown.org` (こちらは常に orange-cloud) だった頃のログを見に行った。そのリクエストは **ずっとログに残っていた**。1 年前から残っていた。自分が正しいレンズで見ていなかっただけだった。

`httpRequestsAdaptiveGroups` を 1 日ずつクエリ (Free プランは 1 クエリ 24 時間制限):

```graphql
query {
  viewer {
    zones(filter: { zoneTag: "..." }) {
      httpRequestsAdaptiveGroups(
        filter: {
          datetime_geq: "2026-05-14T00:00:00Z"
          datetime_leq: "2026-05-14T23:59:59Z"
          clientRequestPath: "/api/auth/login"
        }
        limit: 500
      ) {
        dimensions {
          datetimeMinute
          clientRequestHTTPHost
          edgeResponseStatus
          clientCountryName
          clientRequestHTTPMethodName
        }
        count
      }
    }
  }
}
```

May 14 の結果:

| 時刻 (UTC) | Host | Method | Status | Country | Count |
|---|---|---|---|---|---|
| 02:42–02:43 | feedown.org | POST | **403** | **SG** | 6 |
| 02:50–03:36 | feedown.org | POST | 200 / 401 | JP | (自分のテスト) |

May 15:

| 時刻 (UTC) | Host | Method | Status | Country | Count |
|---|---|---|---|---|---|
| 03:34–03:35 | feedown.org | POST | **403** | **SG** | 3 |

シンガポールから `/api/auth/login` への POST が 6 件、全部 403。タイムスタンプは Apple のレビューウィンドウとぴったり一致。自分はずっと違う日のログを見ていた。

次に同じウィンドウで firewall events を引いた:

```graphql
firewallEventsAdaptive(filter: {
  datetime_geq: "2026-05-14T02:30:00Z"
  datetime_leq: "2026-05-14T03:00:00Z"
  clientCountryName: "SG"
}) {
  datetime clientIP clientRequestHTTPHost clientRequestPath
  clientRequestHTTPMethodName userAgent
  action source ruleId rayName
}
```

```json
{
  "action": "challenge",
  "clientIP": "17.84.123.163",
  "clientRequestHTTPHost": "feedown.org",
  "clientRequestPath": "/api/auth/login",
  "clientRequestHTTPMethodName": "POST",
  "userAgent": "FeedOwn/7 CFNetwork/3860.500.112 Darwin/25.4.0",
  "source": "country",
  "ruleId": "forceroute",
  ...
}
```

`17.0.0.0/8` は Apple の IP レンジ (AS714)。`source: country` + `ruleId: forceroute` の組み合わせは、**国別のルールがマッチして managed challenge を発行している** という意味。JSON を期待しているモバイルクライアントから見れば、これは 403 + HTML body そのまま。

ここに犯人がいた。

## 真因

Cloudflare ダッシュボードの IP Access Rules に行ったら、**6 つのルールが全部 2025-06-02 (約 1 年前) に作られた状態** で残っていた:

| Country | Action | Created |
|---|---|---|
| **SG** | challenge | 2025-06-02 |
| **US** | challenge | 2025-05-31 |
| LU | challenge | 2025-06-03 |
| NO | challenge | 2025-06-02 |
| GB | challenge | 2025-06-02 |
| DE | challenge | 2025-06-02 |

全部 user-scope (アカウント全体に適用)。全部 managed challenge を発行する設定。1 年前に WordPress プローブ対策で入れて、そのまま忘れていたものだった。

**Apple App Review のトラフィックは Singapore (および時々 Cupertino, US) の data center から来る**。Apple レビュアーからの全 POST が SG ルールに hit して、managed challenge の HTML body が返って、モバイルクライアントがその HTML を JSON として parse して失敗していた。

これが特に発見しにくかった理由:

1. **User-scope ルールは特定の zone proxy ではなく、CF edge 全体に適用される**。grey-cloud Pages のトラフィックでも発火する。これが Round 4/5 (grey-cloud の `api.feedown.org`) でも challenge を踏み続けた理由 — analytics の namespace は zone 単位だが、ルール自体は edge にある。
2. **`security_level=essentially_off` も `Bot Fight Mode=off` も IP Access Rules には効かない**。別レイヤ。「ブロックしてそうなもの」を全部 off にしたのに、本物のブロッカーは別の系統で動いていた。
3. **1 年間ずっとそこにあったのに今まで問題にならなかった**。過去 4 回の App Store 審査は SG/US 経由で auth エンドポイントを叩いていなかったか、自分がテストしなかった経路を通っていたのだろう。「何が変わった?」というずっと自分が問うていた質問は、誤った質問だった。正しいのは「**ずっとそこにあって、自分が忘れていたものは何か?**」。

## 本当の修正

```bash
# SG の国別 challenge ルールを削除
curl -X DELETE \
  "https://api.cloudflare.com/client/v4/user/firewall/access_rules/rules/<sg-rule-id>" \
  -H "X-Auth-Email: ..." -H "X-Auth-Key: ..."

# US の国別 challenge ルールを削除
curl -X DELETE \
  "https://api.cloudflare.com/client/v4/user/firewall/access_rules/rules/<us-rule-id>" \
  -H "X-Auth-Email: ..." -H "X-Auth-Key: ..."
```

curl 1 行を 2 回。終わり。

手元から動作確認:

```bash
$ curl -i -X POST https://api.feedown.org/api/auth/login \
    -H "content-type: application/json" \
    -H "user-agent: FeedOwn-Mobile/1.0.9" \
    -d '{"email":"test1@test.com","password":"111111"}'

HTTP/2 200
content-type: application/json; charset=utf-8
cf-ray: 9fc8a2f3386ceb2a-SJC
{"success":true,"user":{...},"token":"eyJ..."}
```

新 build 不要 (失敗は完全にサーバ側のもの)。Resolution Center に送った reply は (要約): *「このアカウントが Singapore data center からのリクエスト (貴方の経路を含む) を Cloudflare の古い国別 challenge ルールで弾いていた事を特定した。ルールは削除済み。既存 build (1.0.7, build 11) のまま再試行をお願いしたい。Server URL は変更なし。」*

Apple の再審査結果待ちだが、診断側は決着した。

## SPA フォールバック「修正」について

4 回目で入れた `onRequest` + `withJsonGuard` の変更はそのまま残す。これは別の独立したバグ — どんな呼び元でも非 POST が HTML 200 を返す状態 — を実際に塞いでいる。これは Apple が踏んでいた呼び元ではなかったというだけで、別の誰にとっては悪い挙動だった。そして締めたエラーフォーマット (`Unexpected html response (HTTP 403 POST)`) は、**5 回目のリジェクトを 1 枚のスクリーンショットで診断可能にした唯一の理由**。これが無かったら、また「JSON Parse error: Unexpected character: <」を見て、また 1 日推測に費やしていた。

つまり: 誤診だったが、修正自体は単独で出荷する価値があった。これは持っていく。

## 教訓

### 1. エラーメッセージは構造的に読む

5 回目のエラー — `Unexpected html response (HTTP 403 POST)` — は 3 つの事実を encode している: method (POST)、status (403)、body type (HTML)。それぞれが説明空間を絞る。

`HTTP 403` + `HTML body` の組み合わせは、ほぼ Cloudflare managed challenge の指紋。`POST` は SPA フォールバック仮説を構造的に否定。**もし自分が締めたエラーフォーマットをもっと早く入れていれば** (実装は 4 回目だった)、4 回目の仮説が間違っていることを submit 前に気付けたはず。

**自分の仮説を反証できるだけの情報をエラーに encode しろ**。

### 2. 「analytics に届かない」≠「Cloudflare に届かない」

Zone analytics が見るのは zone proxy。Cloudflare にはリクエストに作用する他のレイヤがいくつもある: account-scope / user-scope ルール、Pages 内部の保護、DDoS L7 mitigation、Workers route。grey-cloud のカスタムドメインは **zone proxy だけ** をバイパスする、edge 全体をバイパスはしない。「1 つのログ surface に出ない」を「サーバに届いていない」と短絡しない。

### 3. 直近の変更が犯人じゃなさそうな時は、古い config を疑う

4 回ぶん「何が変わった?」と問い続けた。直近の変更にこの regression を説明するものは無かった。答えは 12 ヶ月前のルール — 過去の通った App Store review より古い、プロジェクトの依存の半分より古い。多分ずっと潜在バグだった。今回 Apple のレビュー網のルーティングが何かしらの理由でこの経路を踏んだから顕在化しただけ。**触っていない config も壊れる**。周りの世界が変われば。

### 4. Cloudflare GraphQL Analytics + firewall events がこの種の調査の正解

Cloudflare 上でリクエストが謎の理由で失敗しているとき、2 つのクエリでだいたいカバーできる:

- `httpRequestsAdaptiveGroups` — リクエストは zone に到達したか? どのステータスを返したか?
- `firewallEventsAdaptive` — どの firewall / WAF / managed ルールが作用したか?

Free プランは 1 クエリ 24 時間制限なので、複数日の調査ではループするしかないが、データはちゃんと残っている。API トークンには `Zone → Analytics → Read` + `Account → Analytics → Read` が必要。ダッシュボードのデフォルトトークンには大抵両方は入っていない。

### 5. User-scope ルールは厄介

今回噛んだルールは user-scope = アカウント内の全 zone に適用、特定 zone の WAF 画面で「これがあなたのもの」とは見えにくく、API トークンでは編集不可 (legacy Global API Key のみ)。zone の IP Access Rules セクションに国別 / IP ルールを足した記憶がある人は、定期的に監査すること。**追加した当時のプロジェクトより長生きする**。

### 6. 多層防御は、それが直接の犯人退治にならなくても良いもの

4 回目で入れた `onRequest` + `withJsonGuard` は Apple の症状を直接は塞がなかったが:

- 別の (独立した) バグを塞いだ
- 5 回目のエラーメッセージを 1 枚のスクリーンショットで診断可能にした
- 構造化されたリクエストごとのログを足した (将来のインシデントでも使える)

ある修正が結果的に root cause と無関係だったとしても、それ自体の merits で正当化できる修正なら無駄にはなっていない。**無駄になる失敗様式は、「これがバグを直すかもしれない」だけで justify した修正を ship すること**。

## 状態

執筆時点 (2026-05-16): SG と US の国別ルールは削除済み、App Store Connect の Resolution Center に reply を送って、Apple に既存 build (1.0.7, build 11) での再審査を依頼した。次のレビューウィンドウで `firewallEventsAdaptive` を polling して、Apple の IP に対する challenge action が再発していないか確認する。結果が出たら本記事に追記する。

もし Apple Review でだけ `JSON Parse error: Unexpected character: <` を踏んだことがある人 — 特に Cloudflare をバックエンドに使っている人 — がいたら、ぜひ話を聞かせてほしい。「何年も前の国別ルールが App Review の Singapore 出口を蹴っていた」という niche な話なので、同じ形のバグで週末を溶かした人は他にもいるはず。

---

*FeedOwn は [GitHub](https://github.com/kiyohken2000/feedown) で OSS。`withJsonGuard` ヘルパーは [`functions/lib/jsonResponse.ts`](https://github.com/kiyohken2000/feedown) にある。*
