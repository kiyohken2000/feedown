#!/bin/bash

# Sync .env.shared to apps/web only
# Mobile app does not need Firebase config (uses Pages Functions API)
# Usage: bash scripts/sync-envs.sh

echo "Syncing .env.shared to apps..."

# Check if .env.shared exists
if [ ! -f ".env.shared" ]; then
  echo "Error: .env.shared not found in root directory"
  exit 1
fi

# Copy to apps/web
if [ -d "apps/web" ]; then
  cp .env.shared apps/web/.env
  echo "✓ Synced to apps/web/.env"
else
  echo "⚠ apps/web directory not found"
fi

# Note: Mobile app has its own .env (no Firebase config needed)
echo "ℹ apps/mobile/.env not synced (uses separate config without Firebase)"

echo "✓ Environment sync complete"
