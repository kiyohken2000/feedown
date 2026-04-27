# CLAUDE.md

このファイルは、リポジトリで作業する Claude Code (claude.ai/code) 向けのガイダンスです。

---

## Claude Constitution

### 基本姿勢

- 常に「計画 → 実装 → 検証」の順で進める
- 不明点がある場合は、仮定を明示した上で進めてよい
- 変更は「シンプル」「影響最小」「根本解決」を最優先する

### 品質基準

- 動作を証明できるまで完了としない
- テスト・ログ・差分確認を行う
- 「スタッフエンジニアが承認するか？」を判断基準とする

### コミュニケーション

- 日本語で応答する（コード・変数名は英語）
- 変更内容は常に「なぜ」を説明する

### ドキュメント参照ルール

- プロジェクトの目的・前提・設計・決定事項は **project.md** を参照する
- 詳細な進め方・運用ルール・過去の学びは `tasks__*.md` に記載されている
- `tasks__*.md` は必要な場合のみ明示的に参照する（常時前提とはしない）

### 実行制約について

- 実行可能な操作・禁止事項・出力形式の制約は `tasks__operations.md` に定義されている
- コード変更時は原則として差分（diff）のみを出力する
- 破壊的操作や権限が不明な操作は、必ず事前に確認する

---

## プロジェクト概要

FeedOwn はセルフホスト型の RSS リーダーです。ユーザーが自分の Supabase・Cloudflare アカウントを用意して運用します。Yarn モノレポ構成で以下のワークスペースを含みます：

- `apps/web` — Vite + React 19（Cloudflare Pages にデプロイ）
- `apps/mobile` — Expo + React Native 0.81（App Store / Google Play 公開済み）
- `functions/` — Cloudflare Pages Functions（TypeScript 製 API）
- `packages/shared` — 共通型定義・API クライアント・ユーティリティ（`@feedown/shared`）
- `workers/` — Cloudflare Workers（RSS フェッチ用プロキシ、現在本番では未使用）

## コマンド

### ルートワークスペース

```bash
yarn install
yarn sync-envs         # .env.shared → apps/web/.env にコピー
yarn dev:web           # Web 開発サーバー（localhost:5173）
yarn dev:mobile        # Expo 開発サーバー
yarn dev:workers       # Wrangler 開発サーバー（localhost:8787）
yarn build:web         # Vite 本番ビルド → apps/web/dist/
```

### Web（`apps/web`）

```bash
yarn workspace web dev
yarn workspace web build
yarn workspace web lint
yarn workspace web test:e2e          # Playwright E2E
yarn workspace web test:e2e:ui       # Playwright UI モード
yarn workspace web test:e2e:report   # HTML レポート表示
```

### Functions（`functions/`）

```bash
yarn workspace functions test        # Vitest（シングルラン）
yarn workspace functions test:watch  # Vitest ウォッチ
```

### Mobile（`apps/mobile`）

```bash
yarn workspace mobile start          # Expo 開発
yarn workspace mobile lint
yarn workspace mobile test           # Jest（--passWithNoTests）
```

## デプロイ — 重要事項

**必ずリポジトリルートからデプロイすること**（`apps/web/` からは実行しない）。`functions/` フォルダを Cloudflare Pages デプロイに含める必要があり、`apps/web/` から実行すると除外されて全 API ルートで 405 エラーが発生する。

```bash
# 正しいデプロイ手順
npm run build --workspace=apps/web
npx wrangler pages deploy apps/web/dist --project-name=feedown
```

モバイルビルドは EAS（Expo Application Services）を使用。EAS プロジェクト ID は `09e91d3a-0014-4831-b35f-9962d05db0e3`。

## アーキテクチャ

### API（Cloudflare Pages Functions）

全 API ルートは `functions/api/` に配置。CORS は `functions/_middleware.ts` でグローバルに処理。

主な動作：
- **スマートリフレッシュ**: `POST /api/refresh` は `last_fetched_at` が 6 時間以上前の場合のみ再取得
- **記事 ID**: `feedId:guid` の SHA-256 ハッシュ — 再取得時の重複排除に使用
- **本文抽出**: `GET /api/article-content` が `@mozilla/readability` でフルテキストをパース
- **フィード形式**: RSS 2.0・RSS 1.0（RDF）・Atom に対応
- **トークンリフレッシュ**: `POST /api/auth/refresh` はモバイルで必須。Supabase セッションは約 1 時間で失効

### データベース（Supabase PostgreSQL）

全テーブルで Row Level Security（RLS）が有効 — ユーザーは自分のデータにのみアクセス可能。

- `articles`: `expires_at` カラムによる 7 日間 TTL（インデックス付き）— バックグラウンドのクリーンアップはこれに依存
- `feeds`: エポック値ベースの `order` フィールドで並び順を管理（ドラッグ並び替え対応）
- `favorites`: 無制限のブックマーク、`(user_id, saved_at DESC)` でインデックス

SQL スキーマと RLS ポリシーは `docs/SUPABASE_SETUP.md` に記載。

### Web フロントエンド

状態管理は React Context プロバイダー（`ThemeContext`・`LanguageContext`・`ArticlesContext`）で行う。Supabase クライアントはユーザーのアクセストークンで初期化し、クエリレベルで RLS によるデータ分離を実現。

### モバイルフロントエンド

Redux Toolkit（auth・feeds・articles・UI の各スライス）と AsyncStorage による永続化。QR コードログイン: Web アプリが認証情報を含む QR コードを生成し、モバイルアプリがスキャンしてインポートする。

## 環境変数

`.env.example` を `.env.shared` にコピーして認証情報を記入後、`yarn sync-envs` を実行して `apps/web/.env` に反映する。

| 変数 | 使用箇所 |
|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Web フロントエンド（Vite） |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Cloudflare Pages Functions（Cloudflare ダッシュボードでシークレットとして設定） |

## 主要ドキュメント

- `docs/SETUP.md` — ローカル環境構築の完全ガイド
- `docs/SUPABASE_SETUP.md` — DB スキーマ・RLS ポリシー・インデックス（SQL）
- `docs/API.md` — API エンドポイント一覧
- `docs/DESIGN.md` — データベース設計の意思決定
- `docs/HANDOFF.md` — プロジェクト状況・解決済み既知の問題・デプロイ履歴
