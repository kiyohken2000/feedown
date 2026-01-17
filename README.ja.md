# FeedOwn

**あなたのフィード、あなたのデータ**

Supabase と Cloudflare を使用したセルフホスト型 RSS リーダー

[English](README.md) | 日本語

## 特徴

- 📱 **クロスプラットフォーム**: Web (React) とモバイル (Expo)
- 🔒 **セルフホスト**: データはあなたの Supabase アカウントに保存されます
- ⚡ **サーバーレス**: Cloudflare Pages によりインフラコストゼロ
- 🌐 **オフラインファースト**: インターネットなしで記事を読める
- 🎨 **モダンな UI**: クリーンでレスポンシブなデザイン

## 技術スタック

- **フロントエンド**: Vite + React (Web)、Expo + React Native (Mobile)
- **バックエンド**: Cloudflare Pages Functions
- **データベース**: Supabase PostgreSQL
- **認証**: Supabase Auth

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
```

### ビルド

```bash
# Web アプリをビルド
yarn build:web
```

### デプロイ

#### Cloudflare Pages へのデプロイ

```bash
# ルートディレクトリからビルドとデプロイ
npm run build --workspace=apps/web
npx wrangler pages deploy apps/web/dist --project-name=feedown
```

**重要**: `functions` フォルダを含めるために、必ずルートディレクトリからデプロイしてください。

## プロジェクト構成

```
feedown/
├── apps/
│   ├── web/              # Vite + React
│   └── mobile/           # Expo + React Native
├── packages/
│   └── shared/           # 共有の型とユーティリティ
├── functions/            # Cloudflare Pages Functions (API)
└── docs/                 # ドキュメント
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
