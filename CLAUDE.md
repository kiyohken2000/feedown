# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## プロジェクト概要

**FeedOwn** はセルフホスト型のクロスプラットフォーム RSS リーダー。Cloudflare Pages Functions をバックエンドに、Supabase を DB/認証基盤に使ったサーバーレス構成。

---

## モノレポ構成

Yarn Workspaces によるモノレポ。パッケージ名とディレクトリの対応:

| パッケージ | ディレクトリ | 役割 |
|---|---|---|
| `web` | `apps/web` | Vite + React 19 の Web フロントエンド |
| `mobile` | `apps/mobile` | Expo + React Native のモバイルアプリ |
| `functions` | `functions` | Cloudflare Pages Functions（サーバーレス API） |
| `workers` | `workers` | Cloudflare Workers（RSS フェッチ用） |
| `@feedown/shared` | `packages/shared` | Web/Mobile 共通の型・API クライアント・ユーティリティ |

---

## よく使うコマンド

### 開発サーバー起動
```bash
yarn dev:web          # Web（localhost:5173）
yarn dev:mobile       # Mobile（Expo CLI）
yarn dev:workers      # Workers
```

### ビルド
```bash
yarn build:web        # apps/web/dist に出力
yarn workspace functions build
yarn workspace workers build
yarn workspace @feedown/shared build
```

### テスト
```bash
# E2E テスト（Web）
yarn workspace web test:e2e
yarn workspace web test:e2e:ui      # UI モード
yarn workspace web test:e2e:report  # レポート表示

# ユニットテスト（Functions）
yarn workspace functions test
yarn workspace functions test:watch

# ユニットテスト（Workers）
yarn workspace workers test
yarn workspace workers test:watch
```

### Lint
```bash
yarn workspace web lint
yarn workspace mobile lint
```

### 環境変数の同期
```bash
yarn sync-envs   # .env.shared を各ワークスペースの .env にコピー
```

---

## アーキテクチャ

### データフロー

```
Web / Mobile
    │  Bearer token（Supabase Auth）
    ▼
Cloudflare Pages Functions  (/functions/api/)
    │  Supabase Service Role Key
    ▼
Supabase PostgreSQL（RLS 有効）
```

### 認証

- フロントエンド: Supabase Auth（メール/パスワード）でログイン、JWT トークンを取得
- バックエンド: `functions/lib/auth.ts` の `verifyAuthToken()` で Bearer トークンを検証
- DB レベルでは RLS ポリシーが `auth.uid() = user_id` を強制し、ユーザー間のデータ分離を保証

### API パターン（Functions）

- 各エンドポイントは `onRequestGet/Post/Delete(context)` 形式でエクスポート
- `functions/lib/supabase.ts` でサービスロールクライアントを生成
- 未認証リクエストには 401 を返す

### 記事の自動更新

- `/api/articles` エンドポイントは最終フェッチから 6 時間以上経過していればバックグラウンドでリフレッシュをトリガー
- `/api/refresh` がRSSパースと記事保存を担当
- 記事の有効期限は `expires_at` フィールドで管理（7 日 TTL）

### 共有パッケージ（`@feedown/shared`）

Web・Mobile 両方が以下をインポート:
- `src/types/` — Feed, Article, User 等の TypeScript 型
- `src/api/` — API エンドポイント定数とクライアント関数
- `src/utils/` — 日付、ハッシュ、RSS パーサーユーティリティ

---

## 環境変数

ルートの `.env.shared`（`.env.example` を参考に作成）に記載し `yarn sync-envs` で各 workspace に配布:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_NAME=FeedOwn
VITE_APP_VERSION=1.0.0
VITE_WORKER_URL=  # 任意
```

Cloudflare Pages の **シークレット**（ダッシュボードで設定、コードには含めない）:
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## データベース（Supabase）

主要テーブル: `user_profiles`, `feeds`, `articles`, `read_articles`, `favorites`, `recommended_feeds`

- 全ユーザーテーブルに `user_id` があり RLS で分離
- `articles` テーブルは Realtime 有効（リアルタイム通知用）
- 初期化 SQL は `docs/SUPABASE_SETUP.md` を参照

---

## テスト構成

| 対象 | フレームワーク | 場所 |
|---|---|---|
| Web E2E | Playwright | `apps/web/e2e/` |
| Functions ユニット | Vitest | `functions/test/` |
| Workers ユニット | Vitest | `workers/test/` |

---

## デプロイ

- Web + Functions: Cloudflare Pages（ルートから `wrangler.toml` 参照、ビルド出力は `apps/web/dist`）
- Workers: `yarn workspace workers deploy`（`wrangler deploy`）
- `scripts/deploy.sh` で一括デプロイ可能

---

## 参考ドキュメント

- `docs/DESIGN.md` — DB スキーマ・RLS ポリシー詳細
- `docs/API.md` — API エンドポイント一覧
- `docs/SUPABASE_SETUP.md` — Supabase 初期化手順
- `docs/HANDOFF.md` — 機能・既知の問題・構成の包括的なまとめ
