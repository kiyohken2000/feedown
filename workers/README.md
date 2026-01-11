# FeedOwn Workers

Cloudflare Workers for RSS fetching proxy with CORS support and KV caching.

## Features

- RSS feed fetching with CORS headers
- KV caching (1-hour TTL)
- Rate limiting (same URL once per hour via cache)
- Request timeout (10 seconds)
- Error handling for invalid URLs and network errors

## Development

### Local Testing

```bash
# Start local development server
yarn dev

# Test the fetch endpoint
curl "http://localhost:8787/fetch?url=https://example.com/rss.xml"
```

### Environment Variables

Create `.dev.vars` for local development:

```env
FIREBASE_PROJECT_ID=your-project-id
```

## API

### GET /fetch

Fetch an RSS feed with caching.

**Query Parameters:**
- `url` (required): RSS feed URL

**Response:**
- `200 OK`: Returns XML content
  - `X-Cache: HIT` - Served from cache
  - `X-Cache: MISS` - Freshly fetched
- `400 Bad Request`: Invalid URL or missing parameter
- `504 Gateway Timeout`: Request timeout (10s)
- `500 Internal Server Error`: Network error

**Examples:**

```bash
# Fetch an RSS feed
curl "http://localhost:8787/fetch?url=https://feeds.feedburner.com/TechCrunch/"

# Check cache header
curl -I "http://localhost:8787/fetch?url=https://feeds.feedburner.com/TechCrunch/"
```

## Deployment

### Setup KV Namespace

```bash
# Create KV namespace
wrangler kv:namespace create CACHE

# Update wrangler.toml with the KV namespace ID
# [[kv_namespaces]]
# binding = "CACHE"
# id = "your-kv-namespace-id"
```

### Deploy

```bash
# Deploy to Cloudflare Workers
yarn deploy

# Or from root
yarn build:workers
```

### Set Environment Variables

```bash
# Set Firebase project ID
wrangler secret put FIREBASE_PROJECT_ID
```

## Architecture

```
Client → Worker /fetch?url=...
         ↓
         ├─ Check KV Cache
         ├─ If HIT: Return cached XML
         └─ If MISS:
            ├─ Fetch RSS URL (with timeout)
            ├─ Validate XML
            ├─ Store in KV (TTL: 1 hour)
            └─ Return XML
```

## Caching Strategy

- **Cache Key**: `rss:{url}`
- **TTL**: 3600 seconds (1 hour)
- **Rate Limiting**: Implicitly enforced by cache TTL

## Error Handling

- **Invalid URL**: Returns 400 with error message
- **Timeout**: Returns 504 after 10 seconds
- **Network Error**: Returns 500 with error details
- **Non-XML Response**: Returns 400 with error message
