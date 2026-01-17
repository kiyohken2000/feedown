# FeedOwn 新機能計画書

## 概要

以下の機能を実装予定:

| 機能 | 難易度 | 優先度 |
|------|--------|--------|
| フィードごとの記事一覧 | 低 | 1 |
| 記事の共有 | 低 | 2 |
| フォントサイズ/フォント変更 | 中 | 3 |
| バックグラウンド自動更新 | 高 | 4 |

---

## 1. フィードごとの記事一覧

### 概要
特定のフィードの記事のみを表示する機能。現在は全フィードの記事が混在して表示されている。

### 現状分析

**API:**
- `/api/articles` は既に `feedId` クエリパラメータをサポート済み
- `functions/api/articles/index.ts:46` で `feedId` によるフィルタリング実装済み

**Web:**
- `DashboardPage.jsx` で全記事を表示
- フィルターボタン（All/Unread/Read）は実装済み

**Mobile:**
- `Home.js` で全記事を表示
- 同様のフィルターパターン実装済み

### 実装計画

#### Web (apps/web)

1. **FeedsPage.jsx の修正**
   - フィード一覧にクリックイベントを追加
   - クリック時にそのフィードの記事一覧を表示

2. **DashboardPage.jsx の修正**
   - `selectedFeedId` stateを追加
   - フィード選択UIを追加（ドロップダウンまたはサイドバー）
   - `fetchArticles` 呼び出しに `feedId` パラメータを追加
   - 選択中のフィード名を表示

3. **URLパラメータ対応（オプション）**
   - `/dashboard?feedId=xxx` でフィード指定可能に

#### Mobile (apps/mobile)

1. **FeedsContext.js の修正**
   - `selectedFeedId` stateを追加
   - `fetchArticles(feedId)` メソッドを修正

2. **Feeds.js の修正**
   - フィードタップ時に `FeedArticles` 画面へナビゲート

3. **新規: FeedArticles.js の作成**
   - `scenes/feeds/FeedArticles.js`
   - 特定フィードの記事一覧を表示
   - Home.jsのコンポーネントを再利用

4. **ナビゲーション設定**
   - FeedsStackに `FeedArticles` を追加

### 変更ファイル

```
apps/web/src/pages/DashboardPage.jsx  # フィード選択UI追加
apps/web/src/pages/FeedsPage.jsx      # フィードクリック処理追加

apps/mobile/src/scenes/feeds/Feeds.js        # フィードタップ処理
apps/mobile/src/scenes/feeds/FeedArticles.js # 新規作成
apps/mobile/src/navigation/FeedsStack.js     # ナビゲーション追加
apps/mobile/src/contexts/FeedsContext.js     # selectedFeedId追加
```

### API変更
なし（既存APIで対応可能）

---

## 2. 記事の共有

### 概要
記事をSNSや他アプリに共有する機能。

### 現状分析

**Web:**
- `ArticleModal.jsx` に「元の記事を読む」ボタンあり
- 共有機能なし

**Mobile:**
- `ArticleDetail.js` に「元の記事を読む」ボタンあり
- 共有機能なし
- React Native の `Share` API 利用可能

### 実装計画

#### Mobile (apps/mobile) - 優先

1. **ArticleDetail.js の修正**
   - 共有ボタンを追加（ヘッダーまたは本文下）
   - React Native `Share` API を使用

```javascript
import { Share } from 'react-native';

const handleShare = async () => {
  try {
    await Share.share({
      title: article.title,
      message: `${article.title}\n${article.url}`,
      url: article.url, // iOS only
    });
  } catch (error) {
    console.error('Share error:', error);
  }
};
```

2. **ArticleReader.js の修正**
   - リーダーモードにも共有ボタンを追加

#### Web (apps/web)

1. **ArticleModal.jsx の修正**
   - 共有ボタンを追加
   - Web Share API（対応ブラウザ）またはコピーボタン

```javascript
const handleShare = async () => {
  if (navigator.share) {
    await navigator.share({
      title: article.title,
      url: article.url,
    });
  } else {
    // Fallback: copy to clipboard
    await navigator.clipboard.writeText(article.url);
    alert('URLをコピーしました');
  }
};
```

### 変更ファイル

```
apps/mobile/src/scenes/article/ArticleDetail.js  # 共有ボタン追加
apps/mobile/src/components/ArticleReader.js      # 共有ボタン追加

apps/web/src/components/ArticleModal.jsx         # 共有ボタン追加
```

### API変更
なし

---

## 3. フォントサイズ/フォント変更

### 概要
リーダーモードのフォントサイズとフォントファミリーをカスタマイズ可能にする。

### 現状分析

**Mobile:**
- `ArticleReader.js` で `react-native-render-html` 使用
- フォントサイズはハードコード（body: 17px）
- `ThemeContext.js` はダークモードのみ管理

**Web:**
- `ArticleModal.jsx` で記事プレビュー表示
- 本格的なリーダーモードはなし
- `ThemeContext.jsx` はダークモードのみ管理

### 実装計画

#### Mobile (apps/mobile) - 優先

1. **ThemeContext.js の拡張**

```javascript
// 追加するstate
const [fontSize, setFontSize] = useState('medium'); // small, medium, large, xlarge
const [fontFamily, setFontFamily] = useState('default'); // default, serif, mono

// フォントサイズマッピング
const fontSizeMap = {
  small: { body: 14, h1: 22, h2: 18, h3: 16 },
  medium: { body: 17, h1: 26, h2: 22, h3: 19 },
  large: { body: 20, h1: 30, h2: 26, h3: 22 },
  xlarge: { body: 24, h1: 36, h2: 30, h3: 26 },
};

// フォントファミリーマッピング
const fontFamilyMap = {
  default: Platform.OS === 'ios' ? 'System' : 'Roboto',
  serif: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  mono: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
};
```

2. **AsyncStorage への永続化**
   - `@feedown_fontSize`
   - `@feedown_fontFamily`

3. **ArticleReader.js の修正**
   - ThemeContext からフォント設定を取得
   - `tagsStyles` を動的に生成

4. **Profile.js に設定UIを追加**
   - フォントサイズ選択（4段階）
   - フォントファミリー選択（3種類）
   - プレビュー表示

#### Web (apps/web) - オプション

1. **ThemeContext.jsx の拡張**
   - 同様にフォント設定を追加
   - localStorage に永続化

2. **SettingsPage.jsx に設定UIを追加**

3. **ArticleModal.jsx の修正**
   - フォント設定を適用

### 変更ファイル

```
apps/mobile/src/contexts/ThemeContext.js        # フォント設定state追加
apps/mobile/src/components/ArticleReader.js     # 動的スタイル適用
apps/mobile/src/scenes/profile/Profile.js       # 設定UI追加

apps/web/src/contexts/ThemeContext.jsx          # オプション
apps/web/src/pages/SettingsPage.jsx             # オプション
apps/web/src/components/ArticleModal.jsx        # オプション
```

### API変更
なし

---

## 実装順序

1. **フィードごとの記事一覧** (低難易度、即効性高)
   - Mobile: Feeds.js → FeedArticles.js 新規作成
   - Web: DashboardPage.jsx にフィード選択UI追加

2. **記事の共有** (低難易度、ユーザー価値高)
   - Mobile: ArticleDetail.js に Share ボタン追加
   - Web: ArticleModal.jsx に Share/Copy ボタン追加

3. **フォントサイズ/フォント変更** (中難易度、カスタマイズ性向上)
   - Mobile: ThemeContext 拡張 → ArticleReader 修正 → Profile UI追加
   - Web: オプション（Mobileで様子見）

---

## 4. バックグラウンド自動更新

### 概要

Cloudflare Cron Triggers を使って定期的にフィードを自動更新する。ユーザーがアプリを開いたときに既に最新の記事がある状態にする。

### 現状の問題

- ユーザーが手動で更新ボタンを押さないとフィードが更新されない
- アプリを開いてから更新が始まるため、待ち時間が発生する

### 仕組み

```
現状:
  ユーザー ──(手動で更新ボタン)──> /api/refresh

改善後:
  Cloudflare Cron ──(6時間ごと)──> /api/cron/refresh
                          │
                          ▼
                   全ユーザーのフィードを
                   バックグラウンドで更新
```

### 技術的制約

- **Pages Functions は Cron Triggers 非対応**
  - 専用の Cloudflare Worker を作成する必要がある
  - または外部の cron サービス（GitHub Actions等）から呼び出す

### 実装計画

#### 方法A: Cloudflare Worker（推奨）

1. **新規 Worker の作成**
   - `workers/cron-refresh/` ディレクトリを作成
   - Cron Trigger を設定

2. **wrangler.toml**

```toml
name = "feedown-cron"
main = "src/index.ts"

[triggers]
crons = ["0 */6 * * *"]  # 6時間ごと (UTC)
```

3. **Worker コード**

```typescript
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // 全ユーザーのフィードを取得
    const { data: users } = await supabase
      .from('user_profiles')
      .select('id');

    // 各ユーザーのフィードを更新（並列処理）
    await Promise.allSettled(
      users.map(user => refreshUserFeeds(user.id, env))
    );
  },
};
```

4. **環境変数**
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET`（セキュリティ用）

#### 方法B: GitHub Actions

1. **`.github/workflows/cron-refresh.yml`**

```yaml
name: Refresh Feeds
on:
  schedule:
    - cron: '0 */6 * * *'  # 6時間ごと
  workflow_dispatch:  # 手動実行も可能

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - name: Call refresh endpoint
        run: |
          curl -X POST https://feedown.pages.dev/api/cron/refresh \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

2. **新規エンドポイント `/api/cron/refresh`**
   - シークレットキーで認証
   - 全ユーザーのフィードを更新

### 変更ファイル

```
# 方法A: Worker
workers/cron-refresh/
├── src/index.ts
├── wrangler.toml
└── package.json

# 方法B: GitHub Actions
.github/workflows/cron-refresh.yml
functions/api/cron/refresh.ts  # 新規作成
```

### 更新頻度の選択肢

| 頻度 | Cron式 | 月間実行回数 | ユースケース |
|------|--------|-------------|-------------|
| 1時間ごと | `0 * * * *` | 720回 | ニュース重視 |
| 6時間ごと | `0 */6 * * *` | 120回 | バランス型（推奨） |
| 12時間ごと | `0 */12 * * *` | 60回 | 負荷軽減 |
| 1日1回 | `0 0 * * *` | 30回 | 最小限 |

### 注意事項

- Cloudflare Workers 無料枠: 10万リクエスト/日
- ユーザー数 × フィード数 で処理量が決まる
- 大量ユーザー対応にはバッチ処理が必要
- Supabase の接続数制限（60同時接続）に注意

### API変更

新規エンドポイント:
- `POST /api/cron/refresh` - Cron用の全ユーザー更新

---

## 注意事項

- 1〜3の機能はバックエンド変更不要
- 4はバックエンド（Worker または GitHub Actions）の追加が必要
- モバイルファーストで実装（15年以上RSSリーダーを使っているユーザー向け）
- シンプルさを重視（過度な機能追加を避ける）
- 各機能は独立しているため、個別にリリース可能
