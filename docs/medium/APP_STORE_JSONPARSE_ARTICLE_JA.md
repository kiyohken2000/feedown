# Cloudflare Pages の SPA フォールバックに App Store で 4 連続リジェクトされた話

*「JSON Parse error」から `export` 1 行のバグに辿り着くまでの 4 連敗記録*

---

> **状態 (2026-05-16)**: build 1.0.9 を submit 済みだが、まだ Apple のレビュー待ち。本記事は調査と修正を記録したもので、「実際に通ったかどうか」は承認後に追記する。

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

本記事は、その理由に辿り着くまでに 4 回リジェクトされた話と、最終的に発見した「export 1 行のバグ」の物語。

---

## 構成

[FeedOwn](https://github.com/kiyohken2000/feedown) というセルフホスト型の RSS リーダーを作っている。モバイルは React Native (Expo)、バックエンドは Cloudflare Pages。認証層は Supabase の薄いラッパーで、`functions/api/auth/login.ts` などにある:

```ts
// functions/api/auth/login.ts (バグっていたバージョン)
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

## 4 回目: ログを見に行く

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
          edgeResponseContentTypeName
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

ここでようやく繋がった。

## バグ: SPA フォールバックが API ルートを食っていた

Cloudflare Pages には 2 つのレイヤがある:

1. `functions/` ディレクトリの **Functions** が動的ルートを処理
2. **静的アセット** + マッチしないルート向けの **`index.html` への SPA フォールバック**

`onRequestPost` を export すると、その Function は **POST しか** 処理しない。**他の method はそもそも Function に到達しない** — そのまま静的アセット層に落ちて、`/api/auth/login` という名前のファイルは存在しないので、SPA フォールバックが効いて `index.html` が `200 OK` で返る。

自分の利用ではこの挙動は問題にならなかった。アプリは POST を送る。curl テストも POST。本番ユーザーも POST。**全員 POST を送っていた**。

例外的に、Apple のレビュー網のどこかで、何かが POST 以外を送ってきていた。何が? 正直まだ確証は無い。TLS 透過プロキシが別 verb で再送している? HTTP/2 → HTTP/1.1 のダウングレードで method が壊れた? iOS URLSession の特定条件下の挙動? いずれにしても、リクエストは Cloudflare に POST 以外として到着し、SPA フォールバックに落ちて、Apple のレビュアーは認証レスポンスではなく React アプリの index ページを見ていた。

そしてアプリ側で `JSON.parse('<!doctype html>...')` が走り、スクリーンショットのエラーが完成する。

## 修正: `onRequest` + 多層防御

**Step 1**: `onRequestPost` を `onRequest` に置き換えて、**全 method** を受ける:

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

**Step 2**: ハンドラ内で例外が出ても **絶対に JSON を返す** 共通ヘルパー `withJsonGuard`:

```ts
// functions/lib/jsonResponse.ts
export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...extraHeaders }
  })
}

export function methodNotAllowed(method, allowed) {
  return jsonResponse(
    { error: `Method ${method} not allowed`, allowed },
    405,
    { allow: allowed.join(', ') }
  )
}

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

**Step 3**: `logRequestDiag` で診断ログを仕込み、次に変なリクエストが来たら見えるようにする:

```ts
export function logRequestDiag(label, request) {
  console.log(`[${label}]`, {
    method: request.method,
    country: request.headers.get('cf-ipcountry'),
    ip: request.headers.get('cf-connecting-ip'),
    ua: request.headers.get('user-agent'),
    contentType: request.headers.get('content-type'),
    accept: request.headers.get('accept'),
  })
}
```

**Step 4**: クライアント側のエラーメッセージを締めて、トーストが切り詰められても診断情報が読めるようにする:

```js
throw new Error(
  `Unexpected ${shortContentType(ct)} response (HTTP ${status} ${method}). Please retry.`
)
// → "Unexpected html response (HTTP 200 POST). Please retry."
```

これで、レビュアーの網が何をしようと **HTML が返る経路は物理的に存在しない**。根本原因が特定できなくても、症状は完全に塞がる。

## 検証

修正前:

```bash
$ curl -i https://api.feedown.org/api/auth/login
HTTP/2 200
content-type: text/html; charset=utf-8
<!doctype html>...
```

修正後:

```bash
$ curl -i https://api.feedown.org/api/auth/login
HTTP/2 405
content-type: application/json
allow: POST
{"error":"Method GET not allowed","allowed":["POST"]}
```

```bash
$ curl -i -X PUT https://api.feedown.org/api/auth/login
HTTP/2 405
content-type: application/json
{"error":"Method PUT not allowed","allowed":["POST"]}
```

どの method でも JSON が返る。少なくともこの症状については決着。

## 教訓

### 1. `onRequestPost` は Cloudflare Pages の足撃ち銃

Pages プロジェクトが SPA も配信しているなら、**`onRequestPost` (や `onRequestGet` 等) を単独で使ってはいけない**。常に `onRequest` を export して内部で method 判定する。さもないと、マッチしない method は SPA フォールバックに落ちて HTML 200 が返る — CDN にもロードバランサにも監視ツールにも「エラー」に見えない、最悪の失敗様式。

これは Cloudflare 側のドキュメント不足だと思う。`onRequest*` ファミリーは「便利機能」として紹介されていて、「足撃ち銃」とは書いていない。SPA フォールバックの挙動と組み合わせて初めて発現する罠。

### 2. 本番で動く ≠ Apple のレビュー網で動く

Apple のレビュー網は別物。家の Wi-Fi でも、オフィスでも、普通のキャリアでもない。報告されているもの:

- TLS 透過プロキシ (非標準ポート使うアプリで顕在化しやすい — Agora WebRTC 系で有名)
- IPv6 only
- 予想外の地域からの VPN egress
- **初回起動時** にだけ起きる挙動

レビュー時だけ落ちるなら **「たまたま」と片付けない**。本物のバグがあって、たまたまレビュー網が病的な条件を再現しているだけ。

### 3. ミステリアスな 5xx をデバッグするより防御的 JSON パース

なぜ非 JSON が返るか **不明** な状況では、最も投資効率の高い修正は「サーバが **物理的に** 非 JSON を返せない」状態を作ること。根本原因が分からなくても、その失敗クラス全体を消せる。

```js
// 悪い: JSON だと仮定
const data = await response.json()

// 良い: text で読んで try parse、失敗したら有用なエラー
const text = await response.text()
try { return JSON.parse(text) }
catch { throw new Error(`Non-JSON response (HTTP ${status} ${ct})`) }
```

### 4. Cloudflare GraphQL Analytics は過小評価されている

Cloudflare 上で「リクエストがサーバまで届いてるか怪しい」となったら、GraphQL Analytics API でゾーンに到達したかどうかを断定的に確認できる。罠は API トークンの権限:

- Zone → Analytics → Read
- Account → Analytics → Read
- Cloudflare Pages → Read

…ダッシュボードのデフォルトトークンには大抵これら全部は付いていない。インシデント対応用に新しく発行する。

### 5. レビュアー向け UI ヒントは入れて損は無い

このインシデント後、Sign In フォームの下に **任意の認証失敗で** インラインヒントを表示するようにした:

```
⚠ Connection issue
If sign-in keeps failing, try one of these:
• Disable VPN if enabled
• Switch between Wi-Fi and cellular
• Try again in a moment
```

バグ修正にはならないが、レビュアー (および将来不安定なネットワーク下のユーザー) に赤いトーストだけでなく具体的な次の一手を提示できる。

## 今ならこうする

このプロジェクトを今からやり直すなら:

1. **最初から `onRequest` をデフォルトに**。`onRequestPost` の組み込み method チェックは、SPA フォールバックリスクと引き換えにする価値はない。
2. **全 Function を `withJsonGuard` 風のヘルパーで包む**。内部エラーは worker クラッシュではなく JSON 500 を返す。
3. **API エンドポイントごとに複数 method で叩く合成監視を立てる**。`text/html` が返ったらアラート。
4. **App Store 初回 submit 前に、自分の管理下でないネットワークでテストする**。captive portal 付きカフェ Wi-Fi、企業 VPN、何でも変なやつ。

## 状態

執筆時点 (2026-05-16) で、上記を全部入れた build 1.0.9 を submit 済み、レビュー待ち。結果が出たら本記事に追記する — 「ようやく承認」か「リジェクト 5 回目、より深い穴へ」のどちらか。

もし Apple Review でだけ `JSON Parse error: Unexpected character: <` を踏んだことがある人がいたら、ぜひ話を聞かせてほしい。同じ root cause まで追いきった例は珍しいと思う。

---

*FeedOwn は [GitHub](https://github.com/kiyohken2000/feedown) で OSS。`withJsonGuard` ヘルパーは [`functions/lib/jsonResponse.ts`](https://github.com/kiyohken2000/feedown) にある。*
