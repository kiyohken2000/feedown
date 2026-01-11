# Cloudflare Workers Deployment Guide

This guide walks you through deploying the FeedOwn Worker to Cloudflare.

## Prerequisites

- Cloudflare account (free tier is sufficient)
- Wrangler CLI installed (`yarn global add wrangler` or already installed in this project)
- Cloudflare API token with Workers permissions

## Step 1: Login to Cloudflare

```bash
cd workers
yarn wrangler login
```

This will open a browser window for authentication.

## Step 2: Create KV Namespace

The Worker uses Cloudflare KV for caching RSS feeds. Create a KV namespace:

```bash
# Create production KV namespace
yarn wrangler kv:namespace create CACHE

# Create preview KV namespace (for testing)
yarn wrangler kv:namespace create CACHE --preview
```

You'll see output like:
```
🌀 Creating namespace with title "feedown-worker-CACHE"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "CACHE", id = "abc123..." }
```

## Step 3: Update wrangler.toml

Copy the KV namespace IDs from Step 2 and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CACHE"
id = "your-production-kv-id-here"
preview_id = "your-preview-kv-id-here"
```

Also update the environment variables:

```toml
[vars]
FIREBASE_PROJECT_ID = "your-firebase-project-id"
```

## Step 4: Deploy

Deploy the Worker to Cloudflare:

```bash
yarn deploy
```

This will:
1. Build the TypeScript code
2. Upload to Cloudflare
3. Display your Worker URL

Expected output:
```
✨ Built successfully
🌍 Uploading...
✨ Success! Deployed to https://feedown-worker.your-username.workers.dev
```

## Step 5: Test Deployment

Test the deployed Worker:

```bash
# Replace with your actual Worker URL
curl "https://feedown-worker.your-username.workers.dev/fetch?url=https://feeds.feedburner.com/TechCrunch/"
```

You should receive RSS XML in the response.

Check cache headers:
```bash
curl -I "https://feedown-worker.your-username.workers.dev/fetch?url=https://feeds.feedburner.com/TechCrunch/"
```

First request: `X-Cache: MISS`
Second request (within 1 hour): `X-Cache: HIT`

## Step 6: Update Environment Variables

Update `.env.shared` in the root directory with your Worker URL:

```bash
# Edit .env.shared
VITE_WORKER_URL=https://feedown-worker.your-username.workers.dev

# Sync to apps
yarn sync-envs
```

## Configuration Options

### Custom Domain (Optional)

To use a custom domain instead of `*.workers.dev`:

1. Add a route in `wrangler.toml`:
```toml
routes = [
  { pattern = "worker.yourdomain.com", custom_domain = true }
]
```

2. Deploy:
```bash
yarn deploy
```

3. Cloudflare will automatically create DNS records.

### Rate Limiting (Optional)

The Worker has built-in caching (1 hour TTL), which acts as rate limiting. To add additional rate limiting:

1. Go to Cloudflare Dashboard → Workers → Your Worker
2. Add a Rate Limiting rule
3. Configure limits (e.g., 100 requests/minute per IP)

## Monitoring

### View Logs

```bash
yarn wrangler tail
```

### View Analytics

1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages → feedown-worker
3. Click "Metrics" tab

You'll see:
- Request count
- Error rate
- CPU time
- KV operations

## Troubleshooting

### Error: "KV namespace not found"

Make sure you've created the KV namespace and updated `wrangler.toml` with the correct IDs.

### Error: "Authentication failed"

Run `yarn wrangler login` again.

### Worker returns 500 errors

Check the logs:
```bash
yarn wrangler tail
```

### Cache not working

1. Verify KV namespace is bound correctly
2. Check KV operations in Cloudflare Dashboard
3. Ensure cache TTL is set (default: 3600 seconds)

## Cost Estimation

Cloudflare Workers Free Tier:
- 100,000 requests/day
- 10ms CPU time per request
- KV: 100,000 reads/day, 1,000 writes/day

For FeedOwn:
- Estimated usage: ~5,000 requests/day
- Well within free tier limits

## Rollback

To rollback to a previous version:

```bash
yarn wrangler rollback
```

## Local Development

Before deploying, always test locally:

```bash
yarn dev
```

Then test:
```bash
curl "http://localhost:8787/fetch?url=https://feeds.feedburner.com/TechCrunch/"
```

## Next Steps

After deployment:
1. Update Web and Mobile apps with Worker URL
2. Test RSS fetching from apps
3. Monitor usage in Cloudflare Dashboard
