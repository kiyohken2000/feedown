# Building a $0/Month RSS Reader with Cloudflare and Supabase

*A deep dive into the serverless architecture behind FeedOwn*

---

## Introduction

When I decided to build my own RSS reader, I had one non-negotiable requirement: **it had to cost nothing to run**. Not "cheap"—literally zero dollars per month for personal use.

This article is a technical deep dive into how I achieved that with FeedOwn, a self-hosted RSS reader built entirely on serverless infrastructure.

![FeedOwn Architecture](architecture_diagram.svg)
*FeedOwn System Architecture*

## The Architecture Overview

FeedOwn consists of four main components:

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐              ┌─────────────────────────────┐   │
│  │   Web App   │              │        Mobile App           │   │
│  │  (React)    │              │    (React Native/Expo)      │   │
│  └──────┬──────┘              └──────────────┬──────────────┘   │
└─────────┼────────────────────────────────────┼──────────────────┘
          │                                    │
          │         HTTPS API Calls            │
          ▼                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE EDGE                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────┐    ┌─────────────────────┐     │
│  │   Cloudflare Pages          │    │  Cloudflare Worker  │     │
│  │   ┌───────────────────┐     │    │   (RSS Proxy)       │     │
│  │   │  Static Assets    │     │    │                     │     │
│  │   │  (React Bundle)   │     │    │  ┌───────────────┐  │     │
│  │   └───────────────────┘     │    │  │   KV Cache    │  │     │
│  │   ┌───────────────────┐     │    │  │  (1hr TTL)    │  │     │
│  │   │  Pages Functions  │     │    │  └───────────────┘  │     │
│  │   │  (API Endpoints)  │     │    │                     │     │
│  │   └─────────┬─────────┘     │    └──────────┬──────────┘     │
│  └─────────────┼───────────────┘               │                │
└────────────────┼───────────────────────────────┼────────────────┘
                 │                               │
                 │    SQL Queries                │  Fetch RSS XML
                 ▼                               ▼
┌────────────────────────────────┐    ┌─────────────────────────┐
│         SUPABASE               │    │    External RSS Feeds   │
│  ┌──────────────────────────┐  │    │                         │
│  │      PostgreSQL          │  │    │  • News Sites           │
│  │  ┌────────────────────┐  │  │    │  • Blogs                │
│  │  │ users, feeds,      │  │  │    │  • Podcasts             │
│  │  │ articles, favorites│  │  │    │  • Any RSS/Atom Feed    │
│  │  └────────────────────┘  │  │    │                         │
│  └──────────────────────────┘  │    └─────────────────────────┘
│  ┌──────────────────────────┐  │
│  │    Supabase Auth         │  │
│  │  (JWT Authentication)    │  │
│  └──────────────────────────┘  │
└────────────────────────────────┘
```

Let me break down each component and explain the design decisions.

## 1. Cloudflare Pages Functions: The API Layer

Instead of running a traditional server (Express, FastAPI, etc.), FeedOwn uses **Cloudflare Pages Functions**—serverless functions that run at the edge.

### Why Pages Functions?

- **Zero cold start**: Unlike AWS Lambda, Cloudflare Workers start instantly
- **Global distribution**: Code runs in 300+ data centers worldwide
- **Generous free tier**: 100,000 requests/day for free
- **Integrated with Pages**: Deploy frontend and backend together

### API Structure

```
functions/
├── api/
│   ├── auth/
│   │   ├── login.ts      # POST /api/auth/login
│   │   ├── register.ts   # POST /api/auth/register
│   │   └── refresh.ts    # POST /api/auth/refresh
│   ├── feeds/
│   │   ├── index.ts      # GET/POST /api/feeds
│   │   └── [id].ts       # DELETE/PATCH /api/feeds/:id
│   ├── articles/
│   │   ├── index.ts      # GET /api/articles
│   │   └── [id]/
│   │       ├── read.ts   # POST /api/articles/:id/read
│   │       └── favorite.ts # POST/DELETE
│   ├── refresh.ts        # POST /api/refresh (fetch new articles)
│   └── article-content.ts # GET /api/article-content (reader mode)
├── lib/
│   ├── auth.ts           # JWT verification middleware
│   └── supabase.ts       # Database client
└── _middleware.ts        # CORS headers
```

Each file exports handlers like `onRequestGet`, `onRequestPost`, etc. Cloudflare automatically routes requests based on the file structure.

### Example: The Refresh Endpoint

The most complex endpoint is `/api/refresh`, which fetches RSS feeds and stores new articles:

```typescript
export async function onRequestPost(context: any): Promise<Response> {
  // 1. Verify authentication
  const authResult = await requireAuth(request, env);

  // 2. Get user's feeds from database
  const { data: feeds } = await supabase
    .from('feeds')
    .select('*')
    .eq('user_id', uid);

  // 3. Fetch each RSS feed via the Worker proxy
  for (const feed of feeds) {
    const rssResponse = await fetch(
      `${workerUrl}/fetch?url=${encodeURIComponent(feed.url)}`
    );
    const xmlText = await rssResponse.text();

    // 4. Parse RSS/Atom/RDF XML
    const parsedFeed = await parseRssXml(xmlText);

    // 5. Store new articles (with deduplication)
    await storeArticles(uid, feed.id, parsedFeed.items);
  }

  return Response.json({ success: true, stats });
}
```

## 2. Cloudflare Worker: The RSS Proxy

RSS feeds often block cross-origin requests, and some feeds have aggressive caching. The Worker solves both problems:

```typescript
// workers/src/index.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const feedUrl = url.searchParams.get('url');

    // Check KV cache first
    const cached = await env.RSS_CACHE.get(feedUrl);
    if (cached) {
      return new Response(cached, {
        headers: { 'Content-Type': 'application/xml' }
      });
    }

    // Fetch fresh content
    const response = await fetch(feedUrl, {
      headers: { 'User-Agent': 'FeedOwn/1.0' }
    });
    const xml = await response.text();

    // Cache for 1 hour
    await env.RSS_CACHE.put(feedUrl, xml, { expirationTtl: 3600 });

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
```

### Why a Separate Worker?

- **KV Storage**: Workers can use Cloudflare KV for caching (Pages Functions cannot)
- **Isolation**: RSS fetching is separate from the main API
- **Rate limiting**: Prevents hammering feed sources

## 3. Supabase: Database + Authentication

Supabase provides a PostgreSQL database and authentication system with a generous free tier.

### Database Schema

```sql
-- Users (managed by Supabase Auth, extended with profile)
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RSS Feeds
CREATE TABLE feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  favicon_url TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  last_fetched_at TIMESTAMPTZ,
  UNIQUE(user_id, url)
);

-- Articles (with 7-day TTL for automatic cleanup)
CREATE TABLE articles (
  id TEXT PRIMARY KEY,  -- SHA256 hash of feed_id + guid
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_id UUID REFERENCES feeds(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,  -- Auto-delete after 7 days
  image_url TEXT
);

-- Read status and Favorites
CREATE TABLE read_articles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id TEXT,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, article_id)
);

CREATE TABLE favorites (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id TEXT PRIMARY KEY,
  title TEXT,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security (RLS)

Every table has RLS enabled to ensure users can only access their own data:

```sql
-- Example: feeds table policy
CREATE POLICY "Users can only see their own feeds"
  ON feeds FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own feeds"
  ON feeds FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### Why Supabase over Firebase?

I initially built FeedOwn with Firebase/Firestore, but migrated to Supabase for several reasons:

| Aspect | Firebase Firestore | Supabase PostgreSQL |
|--------|-------------------|---------------------|
| Pricing | Per read/write operation | Per storage + bandwidth |
| Free tier | 50K reads/day, 20K writes/day | Generous, no operation limits |
| Query flexibility | Limited (NoSQL) | Full SQL power |
| JOINs | Not supported | Native support |
| Self-hosting | Not possible | Fully self-hostable |

For an RSS reader that does many reads (article lists), Firestore's per-operation pricing became a concern.

## 4. Mobile App: React Native + Expo

The mobile app is built with Expo, which simplifies React Native development:

```
apps/mobile/
├── src/
│   ├── contexts/
│   │   ├── UserContext.js    # Authentication state
│   │   ├── FeedsContext.js   # Feeds + articles state
│   │   └── ThemeContext.js   # Dark mode
│   ├── scenes/
│   │   ├── home/Home.js      # Article list
│   │   ├── article/ArticleDetail.js
│   │   ├── feeds/Feeds.js    # Feed management
│   │   └── profile/Profile.js # Settings
│   └── utils/
│       └── api.js            # API client with auto-refresh
```

### Token Refresh Flow

Mobile apps need to handle token expiration gracefully. Here's the auto-refresh logic:

```javascript
class ApiClient {
  async request(endpoint, options = {}, isRetry = false) {
    const token = await getAuthToken();
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: { 'Authorization': `Bearer ${token}` }
    });

    // If 401 and not already retrying, refresh token
    if (response.status === 401 && !isRetry) {
      const newToken = await this.refreshToken();
      if (newToken) {
        return this.request(endpoint, options, true);  // Retry
      }
    }

    return response;
  }

  async refreshToken() {
    const refreshToken = await getRefreshToken();
    const response = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    });
    const { token, refreshToken: newRefresh } = await response.json();
    await saveAuthToken(token);
    await saveRefreshToken(newRefresh);
    return token;
  }
}
```

## 5. Reader Mode: Article Extraction

FeedOwn includes a "Reader Mode" that extracts article content, similar to Safari's reader or Pocket:

```typescript
// functions/api/article-content.ts
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';

export async function onRequestGet(context: any): Promise<Response> {
  const url = new URL(context.request.url).searchParams.get('url');

  // Fetch the article HTML
  const response = await fetch(url);
  const html = await response.text();

  // Parse with linkedom (jsdom doesn't work in Workers)
  const { document } = parseHTML(html);

  // Extract article with Mozilla's Readability
  const reader = new Readability(document);
  const article = reader.parse();

  return Response.json({
    title: article.title,
    content: article.content,      // Clean HTML
    textContent: article.textContent,
    byline: article.byline,
    siteName: article.siteName
  });
}
```

### Why linkedom instead of jsdom?

Cloudflare Workers run in a V8 isolate, not Node.js. `jsdom` has Node.js dependencies that don't work in this environment. `linkedom` is a lightweight DOM implementation that works everywhere.

## 6. RSS Parsing: Supporting Multiple Formats

RSS feeds come in three main formats:

1. **RSS 2.0**: Most common, `<item>` inside `<channel>`
2. **Atom**: Used by many blogs, `<entry>` inside `<feed>`
3. **RSS 1.0 (RDF)**: Legacy format, `<item>` outside `<channel>`

```typescript
async function parseRssXml(xmlText: string) {
  const isAtom = xmlText.includes('xmlns="http://www.w3.org/2005/Atom"');
  const isRdf = xmlText.includes('<rdf:RDF') ||
                xmlText.includes('xmlns="http://purl.org/rss/1.0/"');

  if (isAtom) {
    return parseAtomFeed(xmlText);
  } else if (isRdf) {
    return parseRdfFeed(xmlText);  // Items are outside channel!
  } else {
    return parseRss2Feed(xmlText);
  }
}
```

The RDF format was particularly tricky—it took me a while to realize that `<item>` elements are siblings of `<channel>`, not children.

## Cost Analysis: Actually $0/Month

Here's the breakdown of running FeedOwn for personal use:

| Service | Free Tier | My Usage | Cost |
|---------|-----------|----------|------|
| Cloudflare Pages | 100K requests/day | ~1K/day | $0 |
| Cloudflare Workers | 100K requests/day | ~500/day | $0 |
| Cloudflare KV | 100K reads/day, 1GB storage | Minimal | $0 |
| Supabase | 500MB DB, 50K auth users | ~10MB, 1 user | $0 |
| **Total** | | | **$0** |

Even with 10 users, you'd stay well within free tiers. You'd need hundreds of active users before hitting any limits.

## Deployment: One Command

Deploying FeedOwn is a single command from the project root:

```bash
# Build and deploy
npm run build --workspace=apps/web
npx wrangler pages deploy apps/web/dist --project-name feedown
```

This deploys both the static frontend AND the API functions together. No separate backend deployment needed.

## Lessons Learned

### 1. File naming matters in Pages Functions

Having both `.js` and `.ts` files with the same name causes routing conflicts. Cloudflare loads `.js` files first, which broke my API when I had leftover compiled files.

### 2. Always deploy from project root

Running `wrangler pages deploy` from a subdirectory excludes the `functions` folder. The API endpoints return 405 errors because they don't exist.

### 3. Supabase RLS is powerful but tricky

Row Level Security policies run for every query. A misconfigured policy can silently return empty results, making debugging difficult.

### 4. RSS is surprisingly inconsistent

Every feed interprets the spec differently. Date formats, CDATA handling, character encoding—expect edge cases everywhere.

## Conclusion

Building FeedOwn taught me that serverless doesn't mean "toy projects only." With the right architecture, you can build real applications that cost nothing to run.

The combination of Cloudflare (edge compute + CDN) and Supabase (database + auth) is particularly powerful. Both have generous free tiers, excellent developer experience, and scale automatically when needed.

If you're building a side project, consider going serverless-first. You might be surprised how far $0/month can take you.

---

**Links:**
- GitHub: https://github.com/kiyohken2000/feedown
- Live Demo: https://feedown.pages.dev
- App Store: https://apps.apple.com/us/app/feedown/id6757896656
- Google Play: https://play.google.com/store/apps/details?id=net.votepurchase.feedown
