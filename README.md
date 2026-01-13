# FeedOwn

**Own your feeds, own your data**

Self-hosted RSS reader powered by Firebase and Cloudflare.

## Features

- 📱 **Cross-platform**: Web (React) and Mobile (Expo)
- 🔒 **Self-hosted**: Your data stays on your Firebase account
- ⚡ **Serverless**: Zero infrastructure costs with Cloudflare Workers
- 🌐 **Offline-first**: Read articles without internet
- 🎨 **Modern UI**: Clean and responsive design

## Tech Stack

- **Frontend**: Vite + React (Web), Expo + React Native (Mobile)
- **Backend**: Cloudflare Workers + Pages Functions
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication
- **Cache**: Cloudflare KV

## Quick Start

### Prerequisites

- Node.js 22.19.0+
- Yarn 1.22+
- Firebase account
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

# Edit .env.shared with your Firebase and Cloudflare credentials
# Then sync to apps
yarn sync-envs
```

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

# Build Functions (TypeScript)
cd functions && npm run build
```

### Deploy

#### Deploy to Cloudflare Pages (Manual)

```bash
# Build web app first
cd apps/web
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=feedown

# Or deploy from root directory
cd ../..
npx wrangler pages deploy apps/web/dist --project-name=feedown
```

**Note**:
- Replace `feedown` with your Cloudflare Pages project name.
- This project uses manual deployment (GitHub integration is not configured).
- After deployment, you'll receive a unique URL (e.g., `https://1df6fe0b.feedown.pages.dev`).

#### Deploy Cloudflare Workers

```bash
cd workers
npx wrangler deploy
```

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
└── scripts/              # Build and deployment scripts
```

## Documentation

- [Setup Guide](docs/SETUP.md)
- [API Documentation](docs/API.md)
- [Architecture](DESIGN.md)

## License

MIT License - see [LICENSE](LICENSE)

## Contributing

Contributions are welcome! Please read our contributing guidelines first.
