# FeedOwn 引継ぎメモ

## 現在のステータス

**デプロイURL**: https://feedown.pages.dev
**最新コミット**: `1d212ea`
**更新日**: 2026-01-14

| Phase | 状態 |
|-------|------|
| Phase 5: Web UI | ✅ 完了 |
| Phase 6: Cloudflare Pages | ✅ 完了 |
| Phase 7: Firestore最適化 | ✅ 完了 |

---

## 🔥 未解決の問題

### Dashboard無限スクロールが動作しない
- **症状**: 一番下までスクロールしても過去の記事が読み込まれない
- **調査箇所**:
  - `apps/web/src/pages/DashboardPage.jsx` - 無限スクロールロジック。新着記事が表示されない
  - `functions/api/articles/index.ts` - ページネーション処理
- **優先度**: 高

---

## 直近の修正履歴

### Firestoreバッチ書き込み権限問題（2026-01-14）

**問題**: Refreshボタンで新規記事が保存されない（`HTTP 403: PERMISSION_DENIED`）

**原因**: Firestore REST API `batchWrite`でセキュリティルールの`request.auth.uid == userId`が正しく評価されない

**修正**: Firestoreセキュリティルールを変更
```javascript
// 変更前
allow read, write: if request.auth != null && request.auth.uid == userId;

// 変更後
allow read: if request.auth != null && request.auth.uid == userId;
allow write: if request.auth != null;
```

---

## アーキテクチャ概要

```
apps/web/          → React SPA (Vite)
functions/         → Cloudflare Pages Functions (API)
workers/           → Cloudflare Workers (RSSプロキシ + KVキャッシュ)
packages/shared/   → 共通コード
```

### 主要なデータフロー

1. **RSS取得**: Dashboard → `/api/refresh` → Workers(`/fetch?bypass_cache=1`) → RSS配信元
2. **記事保存**: `refresh.ts` → `batchSetDocuments()` → Firestore
3. **既読管理**: `userState/main`ドキュメントに`readArticleIds`配列で一括管理

### Firestore構造

```
users/{uid}/
  ├── feeds/{feedId}           # 登録フィード
  ├── articles/{articleHash}   # 記事（SHA-256ハッシュ）
  ├── favorites/{articleId}    # お気に入り
  └── userState/main           # 既読ID配列（集計ドキュメント）
```

---

## 重要な技術的決定

| 決定事項 | 理由 |
|---------|------|
| 集計ドキュメント方式 | readArticles 1000件読み取り → 1件に削減（99.9%削減） |
| バッチ書き込み | Too many subrequests問題の回避 |
| KVキャッシュ bypass | 手動Refresh時は最新データ取得 |
| 500msデバウンス | 既読マークのAPI呼び出し削減 |

---

## 開発コマンド

```bash
# ローカル開発
cd apps/web && npm run dev

# デプロイ
npx wrangler pages deploy apps/web/dist --project-name=feedown
npx wrangler deploy --config workers/wrangler.toml
```

---

## 低優先度タスク

- お気に入りのページネーション実装
