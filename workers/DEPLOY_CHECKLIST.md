# Workers Deployment Checklist

Follow these steps in order to deploy the FeedOwn Worker.

## ✅ Pre-Deployment Checklist

### 1. Cloudflare Account Setup
- [ ] Create Cloudflare account (free tier is fine)
- [ ] Verify email address
- [ ] Note your Account ID from Dashboard

### 2. Install and Login
```bash
# Navigate to workers directory
cd workers

# Login to Cloudflare
yarn wrangler login
```
- [ ] Browser authentication successful
- [ ] `wrangler whoami` shows your email

### 3. Create KV Namespaces
```bash
# Create production namespace
yarn wrangler kv:namespace create CACHE

# Create preview namespace
yarn wrangler kv:namespace create CACHE --preview
```
- [ ] Production KV namespace created
- [ ] Preview KV namespace created
- [ ] Copy both namespace IDs

### 4. Update Configuration
Edit `wrangler.toml`:
- [ ] Uncomment `[[kv_namespaces]]` section
- [ ] Set `id` to production namespace ID
- [ ] Set `preview_id` to preview namespace ID
- [ ] Set `FIREBASE_PROJECT_ID` to your Firebase project ID
- [ ] (Optional) Set `account_id`

### 5. Verify Code
```bash
# Check TypeScript compilation
yarn tsc --noEmit
```
- [ ] No TypeScript errors

### 6. Test Locally (Optional)
```bash
# Start local dev server
yarn dev
```
- [ ] Server starts successfully
- [ ] Test endpoint: `curl "http://localhost:8787/fetch?url=https://feeds.feedburner.com/TechCrunch/"`
- [ ] Returns XML response

## 🚀 Deployment Steps

### 1. Deploy to Cloudflare
```bash
yarn deploy
```
Expected output:
```
✨ Built successfully
🌍 Uploading...
✨ Success! Deployed to https://feedown-worker.your-username.workers.dev
```
- [ ] Deployment successful
- [ ] Copy Worker URL

### 2. Test Deployed Worker
```bash
# Replace with your actual Worker URL
curl "https://feedown-worker.your-username.workers.dev/fetch?url=https://feeds.feedburner.com/TechCrunch/"
```
- [ ] Returns RSS XML
- [ ] Status code 200
- [ ] Contains `X-Cache` header

### 3. Test Caching
```bash
# First request
curl -I "https://feedown-worker.your-username.workers.dev/fetch?url=https://feeds.feedburner.com/TechCrunch/"
# Should show: X-Cache: MISS

# Second request (within 1 hour)
curl -I "https://feedown-worker.your-username.workers.dev/fetch?url=https://feeds.feedburner.com/TechCrunch/"
# Should show: X-Cache: HIT
```
- [ ] First request: `X-Cache: MISS`
- [ ] Second request: `X-Cache: HIT`

### 4. Update Environment Variables
Edit `.env.shared` in root directory:
```env
VITE_WORKER_URL=https://feedown-worker.your-username.workers.dev
```
- [ ] Worker URL updated in `.env.shared`

Sync to apps:
```bash
cd ..  # Back to root
yarn sync-envs
```
- [ ] Environment variables synced to apps/web
- [ ] Environment variables synced to apps/mobile

### 5. Verify in Cloudflare Dashboard
- [ ] Go to Cloudflare Dashboard → Workers & Pages
- [ ] Find "feedown-worker"
- [ ] Check "Metrics" tab for requests
- [ ] Check "Settings" → "Variables" for FIREBASE_PROJECT_ID

## 🔍 Post-Deployment Verification

### Check Worker Health
- [ ] Worker responds to requests
- [ ] KV caching working
- [ ] No errors in logs (`yarn wrangler tail`)

### Monitor Usage
- [ ] Check request count in Dashboard
- [ ] Verify within free tier limits
- [ ] No error spikes

### Integration Test
- [ ] Web app can fetch RSS feeds via Worker
- [ ] Mobile app can fetch RSS feeds via Worker
- [ ] CORS headers working correctly

## 🐛 Troubleshooting

If deployment fails:
1. Check `wrangler.toml` configuration
2. Verify KV namespace IDs are correct
3. Ensure you're logged in (`wrangler whoami`)
4. Check Cloudflare Dashboard for errors

If Worker returns errors:
1. Check logs: `yarn wrangler tail`
2. Verify KV namespace binding
3. Test locally first: `yarn dev`

## 📝 Notes

- Worker URL format: `https://feedown-worker.your-username.workers.dev`
- Cache TTL: 1 hour (3600 seconds)
- Request timeout: 10 seconds
- Free tier limit: 100,000 requests/day

## ✨ Success!

If all checkboxes are checked, your Worker is deployed and ready to use!

Next step: Deploy Cloudflare Pages (Phase 6)
