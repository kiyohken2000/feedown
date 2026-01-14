# FeedOwn

**あなたのフィード、あなたのデータ**

Supabase と Cloudflare を使用したセルフホスト型 RSS リーダー

[English](README.md) | 日本語

## 特徴

- 📱 **クロスプラットフォーム**: Web (React) とモバイル (Expo)
- 🔒 **セルフホスト**: データはあなたの Supabase アカウントに保存されます
- ⚡ **サーバーレス**: Cloudflare Workers によりインフラコストゼロ
- 🌐 **オフラインファースト**: インターネットなしで記事を読める
- 🎨 **モダンな UI**: クリーンでレスポンシブなデザイン

## 技術スタック

- **フロントエンド**: Vite + React (Web)、Expo + React Native (Mobile)
- **バックエンド**: Cloudflare Workers + Pages Functions
- **データベース**: Supabase PostgreSQL
- **認証**: Supabase Auth
- **キャッシュ**: Cloudflare KV

## クイックスタート

### 前提条件

- Node.js 22.19.0+
- Yarn 1.22+
- Supabase アカウント
- Cloudflare アカウント

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/kiyohken2000/feedown.git
cd feedown

# 依存関係をインストール
yarn install

# 環境変数をコピー
cp .env.example .env.shared

# Supabase と Cloudflare の認証情報で .env.shared を編集
# その後アプリに同期
yarn sync-envs
```

### 開発

```bash
# Web アプリを起動
yarn dev:web

# モバイルアプリを起動
yarn dev:mobile

# Workers をローカルで起動
yarn dev:workers
```

### ビルド

```bash
# Web アプリをビルド
yarn build:web

# Workers をビルド
yarn build:workers

# Functions をビルド (TypeScript)
cd functions && npm run build
```

### デプロイ

#### Cloudflare Pages へのデプロイ（手動）

```bash
# まず Web アプリをビルド
cd apps/web
npm run build

# Cloudflare Pages にデプロイ
npx wrangler pages deploy dist --project-name=feedown

# または、ルートディレクトリからデプロイ
cd ../..
npx wrangler pages deploy apps/web/dist --project-name=feedown
```

**注意**:
- `feedown` を、あなたの Cloudflare Pages プロジェクト名に置き換えてください。
- このプロジェクトは手動デプロイを使用しています（GitHub 連携は設定されていません）。
- デプロイ後、固有の URL（例: `https://1df6fe0b.feedown.pages.dev`）が発行されます。

#### Cloudflare Workers のデプロイ

```bash
cd workers
npx wrangler deploy
```

## プロジェクト構成

```
feedown/
├── apps/
│   ├── web/              # Vite + React
│   └── mobile/           # Expo + React Native
├── packages/
│   └── shared/           # 共有の型とユーティリティ
├── workers/              # Cloudflare Workers (RSS プロキシ)
├── functions/            # Cloudflare Pages Functions (API)
└── scripts/              # ビルドとデプロイのスクリプト
```

## ドキュメント

- [セットアップガイド](docs/SETUP.md)
- [API ドキュメント](docs/API.md)
- [アーキテクチャ](docs/DESIGN.md)
- [進捗状況](docs/PROGRESS.md)
- [引継ぎドキュメント](docs/HANDOFF.md)
- [仕様書](docs/specification.md)

## ライセンス

MIT License - [LICENSE](LICENSE) を参照してください

## コントリビューション

コントリビューションを歓迎します！まずはコントリビューションガイドラインをお読みください。
