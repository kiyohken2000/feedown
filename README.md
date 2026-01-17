# FeedOwn

**Own your feeds, own your data**

Self-hosted RSS reader powered by Supabase and Cloudflare.

English | [日本語](README.ja.md)

## Features

- 📱 **Cross-platform**: Web (React) and Mobile (Expo)
- 🔒 **Self-hosted**: Your data stays on your Supabase account
- ⚡ **Serverless**: Zero infrastructure costs with Cloudflare Pages
- 🔄 **Real-time**: Instant updates via Supabase Realtime
- 🌐 **Offline-first**: Read articles without internet
- 🎨 **Modern UI**: Clean and responsive design with dark mode

## Tech Stack

- **Frontend**: Vite + React (Web), Expo + React Native (Mobile)
- **Backend**: Cloudflare Pages Functions
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Authentication
- **Real-time**: Supabase Realtime

## Quick Start

### Prerequisites

- Node.js 22.19.0+
- Yarn 1.22+
- Python 3.12.4+ (for managing recommended feeds)
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
```

### Build

```bash
# Build Web app
yarn build:web
```

### Deploy

#### Deploy to Cloudflare Pages

```bash
# Build and deploy from root directory
npm run build --workspace=apps/web
npx wrangler pages deploy apps/web/dist --project-name=feedown
```

**Important**: Always deploy from the root directory to include the `functions` folder.

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
| Cloudflare Pages | Unlimited builds |

## License

MIT License - see [LICENSE](LICENSE)

## Contributing

Contributions are welcome! Please read our contributing guidelines first.
