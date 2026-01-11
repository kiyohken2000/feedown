# FeedOwn Pages Functions API

Cloudflare Pages Functions implementation for FeedOwn backend API.

## Implemented Endpoints

### Auth API
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login / token verification

### Feeds API  
- `GET /api/feeds` - List user's feeds
- `POST /api/feeds` - Add new feed
- `DELETE /api/feeds/:id` - Delete feed

### Articles API
- `GET /api/articles` - List articles with smart refresh
  - Query params: `feedId`, `limit`, `offset`, `unreadOnly`
- `POST /api/articles/:id/read` - Mark article as read
- `POST /api/articles/:id/favorite` - Add to favorites
- `DELETE /api/articles/:id/favorite` - Remove from favorites

### Refresh API
- `POST /api/refresh` - Refresh all feeds (fetch RSS, parse, store)

## Environment Variables

Set these in Cloudflare Pages settings:

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
WORKER_URL=https://your-worker.workers.dev
```

## Development

```bash
# Build TypeScript
npm run build

# Deploy via Cloudflare Pages (automatic on git push)
```

## Architecture

- All endpoints require Firebase ID token authentication (except register)
- Uses Firebase Admin SDK for Firestore access
- Fetches RSS feeds via Cloudflare Workers proxy
- Implements smart refresh (6-hour interval)
- Articles expire after 7 days (TTL)

## TODO

- Implement XML parser for Workers environment (currently mock)
- Add OPML import/export endpoints
- Add feed URL validation endpoint
