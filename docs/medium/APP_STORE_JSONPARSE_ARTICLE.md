# How a Cloudflare Pages SPA Fallback Got My App Rejected 4 Times by the App Store

*A 4-rejection journey from "JSON Parse error" to a one-line export bug*

---

> **Status (2026-05-16)**: Build 1.0.9 has been submitted but not yet reviewed. This article documents the investigation and fix. The "did it actually pass?" follow-up will be appended once Apple decides.

---

## What Apple Sent Us

The first rejection arrived under **Guideline 2.1(a) — Performance — App Completeness**. The verbatim message from App Review:

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

…and one screenshot:

![Reviewer's screenshot: Sign In Failed — JSON Parse error: Unexpected character: <](apple-review-jsonparse-error.png)
*Apple Review's screenshot from the first rejection (2026-05-10). Server URL is `https://feedown.pages.dev`. The toast shows React Native's verbatim `JSON Parse error: Unexpected character: <` — meaning `JSON.parse()` was handed a payload starting with `<`, which is almost always HTML.*

That's it. No stack trace, no network log, no indication of what the request looked like on their end. Just a screenshot saying "your app's sign-in is broken on our network."

The catch: **it worked everywhere else**. Every device I owned. Every TestFlight install. Every friend's phone. Every browser tab. The server returned correct JSON to every request I or anyone I knew sent it.

It even worked **on App Review's own network previously**. The same authentication flow — same backend, same client code path — had cleared four prior App Store reviews without a single rejection. Then, on this submission, it suddenly didn't. The app hadn't changed in any way that touched auth. The reviewers hadn't (visibly) changed. Yet from this round on, the very same flow was hitting `JSON Parse error` reliably enough that Apple kept rejecting on it.

This article is the story of the four rejections it took to figure out why, and the one-line bug at the bottom of it.

---

## The Setup

I built [FeedOwn](https://github.com/kiyohken2000/feedown), a self-hosted RSS reader with a React Native (Expo) mobile app and a Cloudflare Pages backend. The auth layer is a thin proxy in front of Supabase, served from `functions/api/auth/login.ts` and friends:

```ts
// functions/api/auth/login.ts (the buggy version)
export async function onRequestPost(context) {
  const { email, password } = await context.request.json()
  const result = await supabase.auth.signInWithPassword({ email, password })
  return new Response(JSON.stringify(result), {
    headers: { 'content-type': 'application/json' }
  })
}
```

Looks fine. Works on every device I tested. Works on the simulator. Works on every TestFlight install. Works on every friend's phone.

It does not work on Apple's review network.

## Rejection 1: "JSON Parse error: Unexpected character: <"

The first rejection screenshot (the one shown at the top of this article) was a classic React Native symptom. `fetch().then(r => r.json())` got handed something starting with `<` — almost certainly HTML. The reviewer's network was returning an HTML page instead of my JSON response.

But **why?** Production worked. TestFlight worked. The endpoint was `https://feedown.pages.dev/api/auth/login`. I assumed it was a CDN cache issue or a transient routing problem. I added a `Cache-Control: no-store` header and a defensive JSON-parse helper:

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

Resubmitted. Confident. Wrong.

## Rejection 2: "feedown.org" didn't help either

I figured maybe `pages.dev` was being filtered or rate-limited from Apple's network. So I bound a custom domain — `feedown.org` — proxied through Cloudflare. Resubmitted.

Same rejection. Same toast. Different domain.

At this point I started looking sideways. Was Supabase the issue? Was the reviewer hitting some kind of regional block? Was iOS 26.5 doing something weird with `URLSession`?

## Rejection 3: DNS-only bypass

If the Cloudflare proxy was inserting some kind of challenge page, maybe I should bypass it entirely. I created `api.feedown.org`, set the DNS record to **DNS-only (grey cloud)**, pointed it at the Pages deployment, and changed the mobile app to use `https://api.feedown.org`.

Now traffic was going `Apple → DNS → Pages` with no Cloudflare zone in between. Surely **this** would work.

Same rejection. Quick Create button — which uses a hardcoded test account and shouldn't depend on any reviewer-typed input — also failed.

![Sign In Failed on api.feedown.org](apple-review-signin-failed.png)
![Quick Create Failed on api.feedown.org](apple-review-quickcreate-failed.png)
*Both screenshots are from a later round, after we'd switched to `https://api.feedown.org` (the DNS-only bypass) and tightened the client-side error message to "The server didn't return a valid response (HTTP…)". Two things to notice: (1) the Server URL field now shows `api.feedown.org`, so Cloudflare's zone is no longer in the path; (2) Quick Create — which generates its own random test email and hits the same endpoint — fails identically to Sign In, ruling out anything the reviewer might have typed.*

This was rejection 3, and I had run out of cheap theories.

## Rejection 4: Going to the Logs

I requested Apple Analytics permissions on a fresh Cloudflare API token and queried the GraphQL Analytics API for the review window (the timestamps come from App Store Connect's review status):

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

The result during Apple's review window: **zero `/api/auth/*` POST requests**. None. Not 400s, not 500s, just nothing.

That confirmed `api.feedown.org` was correctly bypassing the Cloudflare zone (otherwise the requests would show up in zone analytics). The traffic was going directly to Pages — and dying somewhere I couldn't see from the zone log.

So I went back to the basics and ran curl manually:

```bash
$ curl -i https://api.feedown.org/api/auth/login
HTTP/2 200
content-type: text/html; charset=utf-8

<!doctype html><html lang="en">...
```

A `GET` request to my POST endpoint returned **`200 OK` with `text/html`**. Not 405. Not 404. A 200 response with the React app's `index.html`.

That's when it clicked.

## The Bug: SPA Fallback ate my API route

Cloudflare Pages has two layers:

1. **Functions** in `functions/` directory handle dynamic routes
2. **Static assets** + **SPA fallback** to `index.html` for unmatched routes

When you export `onRequestPost`, the Function only handles **POST**. Any other method to that path **doesn't reach the Function at all** — it falls through to the static asset layer, which can't find a literal file at `/api/auth/login`, so it serves the SPA fallback (`index.html`) with `200 OK`.

For my own usage, this never mattered. My mobile app sends POST. My curl tests sent POST. Production users send POST. **Everyone sent POST.**

Except, apparently, something in Apple's review network path. I still don't know exactly what — a TLS-intercepting proxy that retries with a different verb? An HTTP/2 to HTTP/1.1 downgrade that mangled the method? An iOS URLSession quirk under specific network conditions? Whatever it is, the request arrived at Cloudflare as something other than POST, fell through to the SPA fallback, and Apple's reviewer saw the React app's index page instead of an auth response.

The mobile app then ran `JSON.parse('<!doctype html>...')` and threw exactly the error in their screenshot.

## The Fix: `onRequest` + Defense in Depth

**Step 1**: Replace `onRequestPost` with `onRequest`, so the Function catches **every** method:

```ts
// functions/api/auth/login.ts (after)
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

**Step 2**: A shared `withJsonGuard` helper that **guarantees** a JSON response — even if the handler throws:

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

**Step 3**: Diagnostic logging in `logRequestDiag` so the next time a weirdly-shaped request arrives, I can see it:

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

**Step 4**: Tighten the client-side error message so even a truncated toast shows the diagnostic:

```js
throw new Error(
  `Unexpected ${shortContentType(ct)} response (HTTP ${status} ${method}). Please retry.`
)
// → "Unexpected html response (HTTP 200 POST). Please retry."
```

Now, regardless of what the reviewer's network does to the request, **HTML can never be returned**. The symptom is sealed even if the underlying cause never gets identified.

## Verification

Before:

```bash
$ curl -i https://api.feedown.org/api/auth/login
HTTP/2 200
content-type: text/html; charset=utf-8
<!doctype html>...
```

After:

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

Every method returns JSON. Mission accomplished — for this symptom at least.

## Lessons

### 1. `onRequestPost` is a footgun on Cloudflare Pages

If your Pages project also serves a SPA, **never use `onRequestPost`** (or `onRequestGet`, etc.) on its own. Always export `onRequest` and check the method inside. Otherwise, any non-matching method silently falls through to your SPA fallback and returns HTML 200 — the worst possible failure mode because nothing about it looks like an error to a CDN, a load balancer, or a monitoring tool.

I'd argue this is a documentation gap on Cloudflare's side. The `onRequest*` family is presented as a convenience, not as a footgun. The footgun-ness is entirely emergent from the SPA fallback behavior.

### 2. Production works ≠ Apple's reviewer's network works

The Apple review network is its own beast. It's not your home Wi-Fi. It's not your office. It's not even a normal mobile carrier. There are reports of:

- TLS-intercepting proxies (especially for apps that hit non-standard ports — Agora WebRTC apps have hit this)
- IPv6-only paths
- VPN egress from unexpected geos
- Behavior that only triggers on **first launch** of a freshly-installed binary

If your app fails on review but nowhere else, **don't assume it's a fluke**. There's a real bug; you just need a network condition pathological enough to surface it.

### 3. Defensive JSON parsing > debugging mystery 5xx errors

When you don't know **why** a non-JSON response is reaching your client, the highest-leverage fix is to make sure your server **physically cannot** return non-JSON. That eliminates the entire failure class even if you never figure out the root cause.

```js
// Bad: assume the response is JSON
const data = await response.json()

// Good: read text, try parse, throw a useful error if not
const text = await response.text()
try { return JSON.parse(text) }
catch { throw new Error(`Non-JSON response (HTTP ${status} ${ct})`) }
```

### 4. Cloudflare GraphQL Analytics is underrated for this

If you're on Cloudflare and you suspect "the request isn't reaching my server," the GraphQL Analytics API can tell you definitively whether the zone saw the request. The catch is the API token needs:

- Zone → Analytics → Read
- Account → Analytics → Read
- Cloudflare Pages → Read

…and the default tokens generated through the dashboard usually don't have all three. Make a fresh one for incident response.

### 5. Reviewer-friendly UI hints can't hurt

After this incident, I added an inline hint that appears below the Sign In form on **any** auth failure:

```
⚠ Connection issue
If sign-in keeps failing, try one of these:
• Disable VPN if enabled
• Switch between Wi-Fi and cellular
• Try again in a moment
```

This won't fix the bug, but it gives the reviewer (and any future user behind a flaky network) a concrete next step instead of just a red toast.

## What I'd Do Differently

If I were starting this project today:

1. **Default to `onRequest` from day one.** The savings from `onRequestPost`'s built-in method check aren't worth the SPA fallback risk.
2. **Wrap every Function in a `withJsonGuard`-style helper.** Internal errors should produce JSON 500s, not crash the worker.
3. **Set up a synthetic monitor that hits each API endpoint with multiple methods**, alerting if any of them returns `text/html`.
4. **Test on a network you don't control before the first App Store submission.** A coffee shop Wi-Fi with a captive portal, a corporate VPN, anything weird.

## Status

As of writing (2026-05-16), build 1.0.9 with all of the above is submitted and waiting for review. I'll update this article with the outcome — whether it's "finally approved" or "rejection 5, deeper rabbit hole."

If you've hit a similar `JSON Parse error: Unexpected character: <` on Apple Review specifically, I'd love to hear about it. Hard to find people who chased this down to the same root cause.

---

*FeedOwn is open-source on [GitHub](https://github.com/kiyohken2000/feedown). The `withJsonGuard` helper lives in [`functions/lib/jsonResponse.ts`](https://github.com/kiyohken2000/feedown).*
