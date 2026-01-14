# FeedOwn

**Own your feeds, own your data**

Self-hosted RSS reader powered by Supabase and Cloudflare.

English | [日本語](README.ja.md)

## Features

- 📱 **Cross-platform**: Web (React) and Mobile (Expo)
- 🔒 **Self-hosted**: Your data stays on your Supabase account
- ⚡ **Serverless**: Zero infrastructure costs with Cloudflare Workers
- 🔄 **Real-time**: Instant updates via Supabase Realtime
- 🌐 **Offline-first**: Read articles without internet
- 🎨 **Modern UI**: Clean and responsive design with dark mode

## Tech Stack

- **Frontend**: Vite + React (Web), Expo + React Native (Mobile)
- **Backend**: Cloudflare Workers + Pages Functions
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Authentication
- **Real-time**: Supabase Realtime
- **Cache**: Cloudflare KV

## Quick Start

### Prerequisites

- Node.js 22.19.0+
- Yarn 1.22+
- Supabase account
- Cloudflare account

### Installation

```bash
# Clone repository
git clone https://github.com/kiyohken2000/feedown.git
cd feedown

# Install dependencies
yarn install

# Copy environment variables
cp .env.example .env.shared

# Edit .env.shared with your Supabase and Cloudflare credentials
# Then sync to apps
yarn sync-envs
```

### Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL schema in SQL Editor (see [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md))
3. Enable Row Level Security (RLS)
4. Copy your project URL and keys to `.env.shared`

### Development

```bash
# Start Web app
yarn dev:web

# Start Mobile app
yarn dev:mobile

# Start Workers (local)
yarn dev:workers
```

### Build

```bash
# Build Web app
yarn build:web

# Build Workers
yarn build:workers
```

### Deploy

#### Deploy to Cloudflare Pages

```bash
# Build web app first
cd apps/web
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=feedown
```

#### Deploy Cloudflare Workers

```bash
cd workers
npx wrangler deploy
```

#### Set Environment Variables

In Cloudflare Pages dashboard, set these secrets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Project Structure

```
feedown/
├── apps/
│   ├── web/              # Vite + React
│   └── mobile/           # Expo + React Native
├── packages/
│   └── shared/           # Shared types and utilities
├── workers/              # Cloudflare Workers (RSS proxy)
├── functions/            # Cloudflare Pages Functions (API)
└── docs/                 # Documentation
```

## Documentation

- [Supabase Setup Guide](docs/SUPABASE_SETUP.md)
- [Architecture](docs/DESIGN.md)
- [Progress Tracking](docs/PROGRESS.md)
- [Handoff Documentation](docs/HANDOFF.md)
- [Specification](docs/specification.md)

## Environment Variables

### Frontend (.env.shared)
```env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_WORKER_URL=https://feedown-worker.<username>.workers.dev
```

### Backend (Cloudflare Pages secrets)
```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Free Tier Limits

| Service | Limit |
|---------|-------|
| Supabase Database | 500MB |
| Supabase Auth | 50,000 MAU |
| Supabase Realtime | 200 concurrent |
| Cloudflare Workers | 100K req/day |
| Cloudflare KV | 100K reads/day |

## License

MIT License - see [LICENSE](LICENSE)

## Contributing

Contributions are welcome! Please read our contributing guidelines first.
