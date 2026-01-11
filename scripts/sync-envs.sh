#!/bin/bash

# Sync .env.shared to apps/web and apps/mobile
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

# Copy to apps/mobile
if [ -d "apps/mobile" ]; then
  cp .env.shared apps/mobile/.env
  echo "✓ Synced to apps/mobile/.env"
else
  echo "⚠ apps/mobile directory not found"
fi

echo "✓ Environment sync complete"
