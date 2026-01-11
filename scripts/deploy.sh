#!/bin/bash

# FeedOwn Deployment Script
# Deploys Workers and builds Web app for Cloudflare Pages
# Usage: bash scripts/deploy.sh

set -e

echo "🚀 Starting FeedOwn deployment..."

# Deploy Cloudflare Workers
echo ""
echo "📦 Deploying Cloudflare Workers..."
cd workers
yarn deploy
cd ..
echo "✓ Workers deployed"

# Build Web app (Pages will be deployed via GitHub integration)
echo ""
echo "🌐 Building Web app..."
cd apps/web
yarn build
cd ../..
echo "✓ Web app built (push to GitHub to deploy to Pages)"

echo ""
echo "✅ Deployment preparation complete!"
echo ""
echo "Next steps:"
echo "1. Push to GitHub to trigger Cloudflare Pages deployment"
echo "2. Set environment variables in Cloudflare Pages dashboard"
echo "3. Set KV namespace binding in Workers dashboard"
