# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FeedOwn is a self-hosted RSS reader. Users bring their own Supabase and Cloudflare accounts. The stack is a Yarn monorepo with:
- `apps/web` — Vite + React 19 (deployed to Cloudflare Pages)
- `apps/mobile` — Expo + React Native 0.81 (published to App/Play Store)
- `functions/` — Cloudflare Pages Functions (TypeScript API)
- `packages/shared` — Common types, API client, utilities (`@feedown/shared`)
- `workers/` — Cloudflare Workers (optional RSS-fetch proxy; currently unused in production)

## Commands

### Root workspace
```bash
yarn install
yarn sync-envs         # Copy .env.shared → apps/web/.env
yarn dev:web           # Web dev server at localhost:5173
yarn dev:mobile        # Expo dev server
yarn dev:workers       # Wrangler dev at localhost:8787
yarn build:web         # Vite production build → apps/web/dist/
```

### Web (`apps/web`)
```bash
yarn workspace web dev
yarn workspace web build
yarn workspace web lint
yarn workspace web test:e2e          # Playwright E2E
yarn workspace web test:e2e:ui       # Playwright with UI
yarn workspace web test:e2e:report   # Show HTML report
```

### Functions (`functions/`)
```bash
yarn workspace functions test        # Vitest (single run)
yarn workspace functions test:watch  # Vitest watch
```

### Mobile (`apps/mobile`)
```bash
yarn workspace mobile start          # Expo dev
yarn workspace mobile lint
yarn workspace mobile test           # Jest (--passWithNoTests)
```

## Deployment — Critical Notes

**Always deploy from the repository root**, not from `apps/web/`. The `functions/` folder must be included in the Cloudflare Pages deployment; running from `apps/web/` excludes it and causes 405 errors on all API routes.

```bash
# Correct deploy sequence
npm run build --workspace=apps/web
npx wrangler pages deploy apps/web/dist --project-name=feedown
```

Mobile builds use EAS (Expo Application Services). The EAS project ID is `09e91d3a-0014-4831-b35f-9962d05db0e3`.

## Architecture

### API (Cloudflare Pages Functions)

All API routes live in `functions/api/`. CORS is handled globally in `functions/_middleware.ts`.

Key behaviors:
- **Smart refresh**: `POST /api/refresh` only re-fetches a feed if `last_fetched_at` is 6+ hours old.
- **Article IDs**: SHA-256 hash of `feedId:guid` — used for deduplication across re-fetches.
- **Content extraction**: `GET /api/article-content` uses `@mozilla/readability` for full-text parsing.
- **Feed formats**: Parser handles RSS 2.0, RSS 1.0 (RDF), and Atom.
- **Token refresh**: `POST /api/auth/refresh` is critical for mobile; Supabase sessions expire after ~1 hour.

### Database (Supabase PostgreSQL)

Row Level Security is enabled on every table — users can only touch their own rows. Key schema facts:
- `articles`: 7-day TTL via `expires_at` column with an index; background cleanup relies on this.
- `feeds`: ordered via an epoch-based `order` field (supports drag-to-reorder).
- `favorites`: unlimited bookmarks, indexed by `(user_id, saved_at DESC)`.

SQL schema and RLS policies are documented in `docs/SUPABASE_SETUP.md`.

### Web Frontend

State is managed through React Context providers: `ThemeContext`, `LanguageContext`, `ArticlesContext`. The Supabase client is instantiated with the user's access token so RLS enforces isolation at the query level.

### Mobile Frontend

Uses Redux Toolkit (slices for auth, feeds, articles, UI state) with AsyncStorage for persistence. QR-code login: the web app generates a QR code containing auth credentials; the mobile app scans and imports them.

## Environment Variables

Copy `.env.example` to `.env.shared`, fill in credentials, then run `yarn sync-envs` to propagate to `apps/web/.env`.

| Variable | Where used |
|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Web frontend (Vite) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Cloudflare Pages Functions (set as secrets in Cloudflare dashboard) |

## Key Documentation

- `docs/SETUP.md` — Full local setup guide
- `docs/SUPABASE_SETUP.md` — DB schema, RLS policies, indexes (SQL)
- `docs/API.md` — Complete API endpoint reference
- `docs/DESIGN.md` — Database design decisions
- `docs/HANDOFF.md` — Project status, resolved known issues, deployment history
