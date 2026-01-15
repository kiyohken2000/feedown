# FeedOwn 引継ぎドキュメント

**最終更新**: 2026-01-15
**ステータス**: Phase 9 進行中（Expoモバイルアプリ）

---

## 現在の状態

### 完了した作業
- Firebase → Supabase 完全移行
- 全APIエンドポイントがSupabase PostgreSQLで動作
- Supabase Authによる認証
- Web UIが本番環境で稼働中
- **Expoモバイルアプリ: ボイラープレート起動・EASビルド成功**
- **Expoモバイルアプリ: Supabase認証実装完了**（サインイン、サインアップ、サインアウト、自動ログイン）
- **Expoモバイルアプリ: 全画面実装完了**（Articles、Favorites、Feeds、Settings）
- **Recommended Feeds: DB管理に移行**（ハードコードからSupabaseテーブルへ）

### デプロイ情報
- **本番URL（Web）**: https://feedown.pages.dev
- **Cloudflare Pages Project**: feedown
- **Supabase Project**: feedown（ダッシュボードで確認）
- **EAS Project ID**: 09e91d3a-0014-4831-b35f-9962d05db0e3

### デプロイ手順

```bash
# Web版デプロイ（ルートディレクトリから実行すること！）
cd /path/to/feedown
npm run build --workspace=apps/web
npx wrangler pages deploy apps/web/dist --project-name=feedown
```

**重要**: `apps/web`ディレクトリからではなく、**ルートディレクトリから**デプロイすること。
そうしないとfunctionsフォルダが含まれず、APIが405エラーになる。

---

## 既知のバグ・未解決問題

### 1. Clear All Data 後に記事が表示されたままになる問題 🟢 解決済み

**症状**: Settings画面で「Clear All Data」を実行すると、FavoritesとFeedsは削除されるが、Articlesタブに記事が表示されたままになる。

**原因**: フロントエンドのキャッシュ（React state）が残っている。

**解決方法**: タブ/ページにフォーカスが当たったら自動でリフレッシュ
- **Mobile**: `useFocusEffect` で対応（`apps/mobile/src/scenes/home/Home.js`）
- **Web**: `location.pathname` 監視 + `visibilitychange` で対応（`apps/web/src/pages/DashboardPage.jsx`）

---

## 本日の作業内容（2026-01-15）

### モバイルアプリ機能追加

1. **記事詳細画面** (`scenes/article/ArticleDetail.js`)
   - 記事タップで詳細画面に遷移
   - 詳細画面を開いたときに既読マーク
   - Add to Favorites / In Favoritesボタン
   - Visit Originalボタン（外部ブラウザで開く）

2. **お気に入り画面** (`scenes/favorites/Favorites.js`)
   - Favoritesタブ追加（星アイコン）
   - お気に入り一覧表示
   - 記事タップで詳細画面に遷移
   - 削除機能（確認ダイアログ付き）

3. **記事一覧画面の改善** (`scenes/home/Home.js`)
   - All/Unread/Readフィルター
   - Mark All Readボタン
   - 各記事に「Mark as Read」ボタン追加

4. **Settings画面** (`scenes/profile/Profile.js`, `apps/web/src/pages/SettingsPage.jsx`)
   - パスワードヒント追加: "If you didn't set a custom password, the default password is 111111"

5. **FeedsContext更新** (`contexts/FeedsContext.js`)
   - toggleFavoriteでfavorites配列も同時更新（オプティミスティック更新）
   - batchMarkAsRead関数追加

### ナビゲーション構成

ボトムタブ4つ:
- **Articles** (newspaper-o) - 記事一覧 → 記事詳細
- **Favorites** (star) - お気に入り一覧 → 記事詳細
- **Feeds** (rss) - フィード管理
- **Settings** (cog) - 設定

---

## モバイルアプリ開発（Phase 9）

### 現在の状態
- ✅ Expo Go起動成功
- ✅ EAS Build（iOS preview）成功
- ✅ Supabase認証実装完了
- ✅ API連携実装完了（フィード・記事取得）
- ✅ 画面実装完了（Dashboard、フィード管理、設定、記事詳細、お気に入り）
- ✅ UX改善（フィルター、Mark All Read、おすすめフィード）
- ✅ ボトムタブ4つ（Articles / Favorites / Feeds / Settings）

### 主要バージョン
```json
{
  "expo": "~54.0.31",
  "expo-updates": "~29.0.16",
  "react-native": "0.81.5",
  "react-native-reanimated": "~4.1.0",
  "react-native-worklets": "0.5.1",
  "@supabase/supabase-js": "^2.45.0"
}
```

### モバイルアプリ起動手順

```bash
# Expo Go で起動
cd apps/mobile
npx expo start --clear

# EAS Build（iOS preview）
cd apps/mobile
eas build --profile preview --platform ios

# EAS Build（Android preview）
cd apps/mobile
eas build --profile preview --platform android
```

### モノレポ構成の注意点

1. **エントリポイント**: `apps/mobile/App.js`で`registerRootComponent`を直接呼び出し
2. **babel.config.js**: module-resolverでエイリアス設定済み（`utils`, `theme`, `components`等）
3. **reanimated/plugin**: 必ずプラグインリストの**最後**に配置

### 主要ファイル一覧（モバイル）

```
apps/mobile/src/
├── contexts/
│   ├── FeedsContext.js      # フィード・記事状態管理
│   └── UserContext.js       # 認証状態管理
├── scenes/
│   ├── home/Home.js         # 記事一覧（フィルター、Mark All Read）
│   ├── article/ArticleDetail.js  # 記事詳細
│   ├── favorites/Favorites.js    # お気に入り一覧
│   ├── read/Read.js         # フィード管理
│   └── profile/Profile.js   # 設定
├── routes/navigation/
│   ├── tabs/Tabs.js         # ボトムタブ設定
│   └── stacks/
│       ├── HomeStacks.js    # Articles + ArticleDetail
│       ├── FavoritesStacks.js # Favorites + FavoriteDetail
│       └── ...
└── utils/
    ├── api.js               # APIクライアント
    └── supabase.js          # Supabase設定
```

---

## 次のタスク候補

### 優先度高（UX改善）
- [ ] **Articlesタブにフォーカス時の自動リフレッシュ実装** (`useFocusEffect`使用)

### 優先度高（Phase 9 継続）
- [ ] モバイルアプリ: Expo Goでテスト
- [ ] モバイルアプリ: EAS Build（iOS/Android）

### 優先度中
- [ ] リアルタイム更新機能（Supabase Realtime）
- [ ] E2Eテスト（Playwright）
- [ ] API仕様書作成

### 優先度低
- [ ] パフォーマンス最適化
- [ ] 多言語対応
- [ ] Androidビルド確認

---

## 開発環境セットアップ

### 必要なもの
- Node.js 18+
- npm
- Cloudflare アカウント（wrangler CLI）
- Supabase プロジェクト

### ローカル起動手順

```bash
# 1. 依存関係インストール
npm install

# 2. Vite開発サーバー起動（別ターミナル）
cd apps/web && npm run dev

# 3. Wrangler Pages起動（APIサーバー）
cd apps/web && npx wrangler pages dev dist \
  --compatibility-date=2024-01-01 \
  --binding SUPABASE_URL=https://xxxxx.supabase.co \
  --binding SUPABASE_ANON_KEY=your-anon-key \
  --binding SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  --binding WORKER_URL=https://feedown-worker.votepurchase.workers.dev
```

### 環境変数

**フロントエンド** (`apps/web/.env.shared`):
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=
```

**Cloudflare Pages** (Secrets):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WORKER_URL`

---

## アーキテクチャ

```
┌─────────────────┐     ┌─────────────────────┐
│   Web App       │────▶│  Cloudflare Pages   │
│   (React/Vite)  │     │  Functions (API)    │
└─────────────────┘     └──────────┬──────────┘
                                   │
┌─────────────────┐     ┌──────────▼──────────┐
│   Mobile App    │────▶│     Supabase        │
│   (Expo)        │     │  - PostgreSQL       │
└─────────────────┘     │  - Auth             │
                        └─────────────────────┘

┌─────────────────┐     ┌─────────────────────┐
│  RSS Feeds      │────▶│  Cloudflare Worker  │
│  (External)     │     │  (Proxy + Cache)    │
└─────────────────┘     └─────────────────────┘
```

---

## データベーススキーマ

### テーブル一覧
- `user_profiles` - ユーザー情報
- `feeds` - RSSフィード
- `articles` - 記事（7日TTL）
- `read_articles` - 既読記事
- `favorites` - お気に入り
- `recommended_feeds` - おすすめフィード（公開データ）

### RLS (Row Level Security)
全テーブルでRLS有効。ユーザーは自分のデータのみアクセス可能。
`recommended_feeds`は公開テーブル（誰でも読み取り可能）。

---

## Recommended Feeds 管理

おすすめフィードはDBで管理され、Pythonスクリプトで更新します。

### 更新手順

```bash
# 1. scripts/sync_recommended_feeds.py の RECOMMENDED_FEEDS リストを編集
# 2. 依存関係インストール（初回のみ）
pip install -r scripts/requirements.txt

# 3. スクリプト実行（.env.shared に SUPABASE_SERVICE_ROLE_KEY が必要）
python scripts/sync_recommended_feeds.py

# 4. Web版をデプロイ（キャッシュクリアのため）
npm run build --workspace=apps/web
npx wrangler pages deploy apps/web/dist --project-name=feedown
```

### 関連ファイル
- `scripts/sync_recommended_feeds.py` - フィード一覧とDB同期スクリプト
- `scripts/recommended_feeds_schema.sql` - テーブル定義SQL
- `functions/api/recommended-feeds.js` - APIエンドポイント（GET /api/recommended-feeds）

---

## 既知の制限事項

1. **Delete Account**: Supabase Auth recordが残る可能性あり（データは削除される）
2. **記事の有効期限**: 7日後に自動削除される設計
3. **リアルタイム更新**: 未実装（Phase 8 Step 4）
4. **Clear All Data後の表示**: タブ切り替え時の自動リフレッシュ未実装（useFocusEffectで対応予定）

---

## トラブルシューティング

### 記事が表示されない
1. ブラウザのキャッシュをクリア（Ctrl+Shift+R）
2. DevToolsのNetworkタブで「Disable cache」有効化
3. wranglerログで`[Refresh]`と`[Articles]`を確認

### API 500エラー
1. wranglerターミナルでエラーログ確認
2. Supabase Dashboardでログ確認
3. 環境変数が正しく設定されているか確認

### API 405エラー
1. **ルートディレクトリからデプロイしているか確認**
2. `apps/web`からデプロイするとfunctionsが含まれない

### 認証エラー
1. Supabase DashboardでAuthenticationログ確認
2. JWTトークンの有効期限確認
3. RLSポリシーが正しく設定されているか確認

### モバイルアプリが起動しない
1. `npx expo start --clear` でキャッシュクリア
2. `node_modules`削除後に`npm install`
3. babel.config.jsのエイリアス設定確認

### EAS Buildエラー
1. `npx expo install --fix` で依存関係を自動修正
2. `eas.json`のNodeバージョン確認（22.19.0）
3. ビルドログで具体的なエラーを確認

---

## 連絡先・リソース

- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **Supabase Dashboard**: https://app.supabase.com
- **GitHub Issues**: プロジェクトのIssueトラッカー
