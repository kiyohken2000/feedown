# Functions Deployment Checklist

## Pre-Deployment

- [x] All TypeScript files compile without errors
- [x] API structure validated (8/8 endpoints)
- [x] Authentication middleware implemented
- [x] Firebase Admin SDK integration complete
- [ ] XML parser implementation (currently mock)

## Cloudflare Pages Setup

### 1. Environment Variables

Set these in Cloudflare Pages dashboard:

```bash
# From service-account.json
FIREBASE_PROJECT_ID=feedown-e78c4
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@feedown-e78c4.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Workers URL
WORKER_URL=https://feedown-worker.votepurchase.workers.dev
```

**Important**:
- Use the exact values from `service-account.json`
- For `FIREBASE_PRIVATE_KEY`, replace actual newlines with `\n`
- Keep the quotes around the private key

### 2. Build Configuration

Cloudflare Pages will automatically:
- Detect `functions/` directory
- Deploy Pages Functions
- Use TypeScript compilation

No build command needed for Functions (handled automatically).

### 3. Deployment

```bash
# Option 1: Git push (automatic deployment)
git push origin main

# Option 2: Manual deployment via Wrangler
npx wrangler pages publish apps/web/dist --project-name=feedown
```

## Post-Deployment Testing

### Test Auth Endpoints

```bash
# Register new user
curl -X POST https://feedown-{username}.pages.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Login
curl -X POST https://feedown-{username}.pages.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","idToken":"..."}'
```

### Test Feeds Endpoints (with authentication)

```bash
# Get feeds
curl https://feedown-{username}.pages.dev/api/feeds \
  -H "Authorization: Bearer YOUR_TOKEN"

# Add feed
curl -X POST https://feedown-{username}.pages.dev/api/feeds \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/feed.xml","title":"Example Feed"}'
```

### Test Articles & Refresh

```bash
# Refresh feeds
curl -X POST https://feedown-{username}.pages.dev/api/refresh \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get articles
curl https://feedown-{username}.pages.dev/api/articles \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Check Firebase token is valid
   - Verify `FIREBASE_PRIVATE_KEY` is correctly formatted

2. **500 Internal Server Error**
   - Check Cloudflare Pages logs
   - Verify all environment variables are set
   - Check Firebase Admin SDK can connect

3. **CORS Errors**
   - `_middleware.ts` should handle CORS automatically
   - Check browser console for specific error

### Logs

View logs in Cloudflare Dashboard:
```
Pages > feedown > Settings > Functions > Logs
```

## Rollback

If deployment fails:

```bash
# Revert to previous deployment
# Via Cloudflare Dashboard: Deployments > Rollback
```

## Status

- [x] Code ready
- [x] Environment variables documented
- [ ] Workers deployed and tested
- [ ] Functions deployed
- [ ] End-to-end testing complete
