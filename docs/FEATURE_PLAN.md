# FeedOwn 新機能計画書

## 概要

以下の機能を実装予定:

| 機能 | 難易度 | 優先度 | 状態 |
|------|--------|--------|------|
| フィードごとの記事一覧 | 低 | 1 | ✅ 完了 |
| 記事の共有 | 低 | 2 | ✅ Mobile完了 |
| フォントサイズ変更 | 中 | 3 | ✅ Mobile完了 |
| バックグラウンド自動更新 | 高 | 4 | 未実装 |
| QRコードログイン | 低 | 5 | 🔄 実装中 |

---

## 1. フィードごとの記事一覧 ✅ 完了

### 概要
特定のフィードの記事のみを表示する機能。現在は全フィードの記事が混在して表示されている。

### 実装済み（2026-01-18）

**Web版**: `apps/web/src/pages/DashboardPage.jsx`にフィード選択ドロップダウンを追加
- `selectedFeedId` stateで選択中のフィードを管理
- `fetchArticles`に`feedId`パラメータを渡して絞り込み
- フィード変更時に自動で記事を再取得

**Mobile版**: `apps/mobile/src/scenes/home/Home.js`にフィード選択ドロップダウンを追加
- `react-native-element-dropdown` パッケージを使用
- ヘッダー右側にドロップダウンを配置
- `selectedFeedId` stateで選択中のフィードを管理
- フィード変更時に自動で記事を再取得
- ダークモード対応

---

### Mobile版 実装詳細（参考用）

#### 概要
Web版と同じアプローチで、Articles画面（Home.js）にフィード選択ドロップダウンを追加する。
`react-native-element-dropdown` パッケージを使用。

#### 実装手順

**Step 0: パッケージインストール**

```bash
# ルートディレクトリから実行
yarn workspace mobile add react-native-element-dropdown
```

**Step 1: Home.jsにselectedFeedId stateを追加**

`apps/mobile/src/scenes/home/Home.js`

```javascript
import { Dropdown } from 'react-native-element-dropdown'

const [selectedFeedId, setSelectedFeedId] = useState('')
```

**Step 2: FeedsContextのfetchArticlesを修正**

`apps/mobile/src/contexts/FeedsContext.js`

```javascript
// feedIdパラメータを追加
const fetchArticles = useCallback(async (reset = true, limit = 50, feedId = null) => {
  // ...
  const response = await api.articles.list({
    limit,
    offset: currentOffset,
    feedId: feedId || undefined,  // ← これを追加
  })
  // ...
}, [getApi])
```

**Step 3: Home.jsにDropdownコンポーネントを追加**

フィルターボタン（All/Unread/Read）の上にドロップダウンを追加：

```javascript
// ドロップダウン用データを生成
const feedDropdownData = useMemo(() => [
  { label: 'All Feeds', value: '' },
  ...feeds.map(feed => ({
    label: feed.title || feed.url,
    value: feed.id,
  }))
], [feeds])

// JSX
<View style={styles.dropdownContainer}>
  <Dropdown
    style={styles.dropdown}
    placeholderStyle={styles.dropdownText}
    selectedTextStyle={styles.dropdownText}
    data={feedDropdownData}
    maxHeight={300}
    labelField="label"
    valueField="value"
    placeholder="All Feeds"
    value={selectedFeedId}
    onChange={item => setSelectedFeedId(item.value)}
  />
</View>
```

**Step 4: スタイル追加**

```javascript
dropdownContainer: {
  paddingHorizontal: 16,
  paddingVertical: 8,
},
dropdown: {
  height: 44,
  borderColor: colors.primary,
  borderWidth: 2,
  borderRadius: 8,
  paddingHorizontal: 12,
  backgroundColor: theme.card,
},
dropdownText: {
  fontSize: 14,
  color: theme.text,
  fontWeight: '600',
},
```

**Step 5: fetchArticles呼び出しにselectedFeedIdを渡す**

```javascript
// handleRefresh
const handleRefresh = useCallback(async () => {
  await refreshAll(selectedFeedId)
}, [refreshAll, selectedFeedId])

// handleLoadMore
const handleLoadMore = useCallback(async () => {
  if (!isLoading && hasMore) {
    await fetchArticles(false, 50, selectedFeedId)
  }
}, [isLoading, hasMore, fetchArticles, selectedFeedId])
```

**Step 6: selectedFeedId変更時に記事を再取得**

```javascript
// selectedFeedId変更時
const prevFeedIdRef = useRef(selectedFeedId)
useEffect(() => {
  if (prevFeedIdRef.current !== selectedFeedId && user) {
    fetchArticles(true, 50, selectedFeedId)
  }
  prevFeedIdRef.current = selectedFeedId
}, [selectedFeedId, user, fetchArticles])
```

#### 変更ファイル一覧

| ファイル | 変更内容 |
|---------|----------|
| `apps/mobile/package.json` | `react-native-element-dropdown` 追加 |
| `scenes/home/Home.js` | Dropdown追加、selectedFeedId state追加 |
| `contexts/FeedsContext.js` | `fetchArticles`にfeedIdパラメータ追加 |

#### UI設計

```
┌─────────────────────────────────────┐
│  ┌─────────────────────────────┐    │
│  │ All Feeds                 ▼ │    │  ← ドロップダウン
│  └─────────────────────────────┘    │
├─────────────────────────────────────┤
│  [All] [Unread] [Read]  [Mark All]  │  ← 既存のフィルター
├─────────────────────────────────────┤
│  記事カード                          │
│  記事カード                          │
│  ...                                 │
└─────────────────────────────────────┘

ドロップダウンをタップすると:
┌─────────────────────────────────────┐
│  ┌─────────────────────────────┐    │
│  │ All Feeds              ✓   │    │
│  │ TechCrunch                 │    │
│  │ The Verge                  │    │
│  │ Engadget                   │    │
│  │ ...                        │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

#### 備考
- Web版と同じパターンで実装（新規画面不要）
- 変更ファイルは3つ（package.json含む）
- `react-native-element-dropdown` は週間DL 10万超の人気パッケージ
- ダークモード対応も容易（theme.card, theme.textを使用）

---

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

## 2. 記事の共有 ✅ Mobile版完了

### 概要
記事をSNSや他アプリに共有する機能。

### 実装済み（2026-01-18）

**Mobile版**: `apps/mobile/src/scenes/article/ArticleDetail.js`にShareボタンを追加
- ヘッダー右側にShareアイコンボタンを配置
- React Native の `Share` API を使用
- 記事タイトルとURLを共有

```javascript
import { Share } from 'react-native';

const handleShare = async () => {
  try {
    await Share.share({
      message: `${article.title}\n\n${article.url}`,
      url: article.url,
      title: article.title,
    });
  } catch (error) {
    console.error('Share error:', error);
  }
};
```

**Web版**: 実装不要
- ユーザー要件によりWeb版での共有機能は不要

### 変更ファイル

```
apps/mobile/src/scenes/article/ArticleDetail.js  # 共有ボタン追加
```

### API変更
なし

---

## 3. フォントサイズ変更 ✅ Mobile版完了

### 概要
リーダーモードのフォントサイズをカスタマイズ可能にする。

### 実装済み（2026-01-18）

**Mobile版**: フォントサイズ設定を実装
- `ThemeContext.js`に`readerFontSize` stateを追加
- 4段階のサイズオプション（Small, Medium, Large, Extra Large）
- AsyncStorageに永続化（`@feedown_readerFontSize`）
- `ArticleReader.js`で動的にフォントサイズを適用
- `Profile.js`に設定UIを追加（Readerセクション）

```javascript
// ThemeContext.js
export const FONT_SIZE_OPTIONS = {
  small: { label: 'Small', bodySize: 15, lineHeight: 24 },
  medium: { label: 'Medium', bodySize: 17, lineHeight: 28 },
  large: { label: 'Large', bodySize: 19, lineHeight: 32 },
  xlarge: { label: 'Extra Large', bodySize: 21, lineHeight: 36 },
}
```

**フォントファミリー変更**: 実装不要
- ユーザー要件によりフォント変更機能は不要

**Web版**: 実装不要
- ユーザー要件によりWeb版でのフォントサイズ変更は不要

### 変更ファイル

```
apps/mobile/src/contexts/ThemeContext.js        # フォント設定state追加
apps/mobile/src/components/ArticleReader.js     # 動的スタイル適用
apps/mobile/src/scenes/profile/Profile.js       # 設定UI追加
```

### API変更
なし

---

## 実装順序

1. **フィードごとの記事一覧** ✅ 完了（2026-01-18）
   - Web: DashboardPage.jsx にフィード選択UI追加 ✅
   - Mobile: Home.js にフィード選択ドロップダウン追加 ✅

2. **記事の共有** ✅ Mobile版完了（2026-01-18）
   - Mobile: ArticleDetail.js に Share ボタン追加 ✅
   - Web: 不要（ユーザー要件）

3. **フォントサイズ変更** ✅ Mobile版完了（2026-01-18）
   - Mobile: ThemeContext 拡張 → ArticleReader 修正 → Profile UI追加 ✅
   - Web: 不要（ユーザー要件）
   - フォント変更: 不要（ユーザー要件）

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

- 1〜3の機能はバックエンド変更不要 → **全て完了**
- 4はバックエンド（Worker または GitHub Actions）の追加が必要 → **未実装**
- モバイルファーストで実装（15年以上RSSリーダーを使っているユーザー向け）
- シンプルさを重視（過度な機能追加を避ける）
- 各機能は独立しているため、個別にリリース可能

## 完了サマリー（2026-01-18）

| 機能 | Web | Mobile | 備考 |
|------|-----|--------|------|
| フィードごとの記事一覧 | ✅ | ✅ | 両プラットフォーム完了 |
| 記事の共有 | - | ✅ | Web版は不要 |
| フォントサイズ変更 | - | ✅ | Web版は不要 |
| フォント変更 | - | - | 実装不要 |
| バックグラウンド自動更新 | - | - | 今後検討 |
| QRコードログイン | ✅ | 🔄 | 実装中 |

---

## 5. QRコードログイン 🔄 実装中

### 概要

Web版Settings画面にQRコードを表示し、モバイルアプリでスキャンしてログインを簡略化する機能。

### アプローチ

QRコードにはサーバーURLとメールアドレスのみを含め、パスワードはユーザーが手動入力する。

**メリット:**
- 新規API不要（既存のlogin APIをそのまま使用）
- トークンがQRに含まれないので安全
- 実装がシンプル

### QRコードの内容

```json
{
  "server": "https://feedown.pages.dev",
  "email": "user@example.com"
}
```

### ユーザーフロー

```
1. Web Settings画面を開く
   ↓
2. 「Mobile Login」セクションにQRコードが表示される
   ↓
3. モバイルアプリのSignIn画面で「Scan QR Code」をタップ
   ↓
4. カメラが起動、QRコードをスキャン
   ↓
5. SignIn画面に戻り、サーバーURLとメールアドレスが自動入力
   ↓
6. ユーザーがパスワードを入力して「Sign In」
   ↓
7. ログイン完了
```

### 変更ファイル一覧

#### Web版

| ファイル | 変更内容 |
|---------|----------|
| `apps/web/package.json` | `qrcode.react` パッケージ追加 |
| `apps/web/src/pages/SettingsPage.jsx` | QRコード表示セクション追加 |

#### Mobile版

| ファイル | 変更内容 |
|---------|----------|
| `apps/mobile/package.json` | `expo-camera` パッケージ追加 |
| `apps/mobile/src/scenes/signin/SignIn.js` | 「Scan QR Code」ボタン追加、QRデータ受け取り処理 |
| `apps/mobile/src/scenes/signin/QrScanner.js` | 新規作成：QRスキャン画面 |
| `apps/mobile/src/routes/navigation/stacks/LoginStacks.js` | QrScanner画面をナビゲーションに追加 |

### 実装詳細

#### Web版: SettingsPage.jsx

Account Informationセクションの下に「Mobile Login」セクションを追加：

```jsx
import { QRCodeSVG } from 'qrcode.react';
import { FaMobileAlt } from 'react-icons/fa';

// Account Informationセクションの後に追加
<div style={styles.card}>
  <h2 style={styles.sectionHeading}>
    <FaMobileAlt style={{ marginRight: 8 }} />
    Mobile Login
  </h2>
  <p style={styles.infoText}>
    Scan this QR code with the FeedOwn mobile app to auto-fill your server URL and email.
  </p>
  <div style={{ textAlign: 'center', padding: '20px 0' }}>
    <QRCodeSVG
      value={JSON.stringify({
        server: window.location.origin,
        email: user?.email || ''
      })}
      size={200}
      bgColor={isDarkMode ? '#2d2d2d' : '#ffffff'}
      fgColor={isDarkMode ? '#ffffff' : '#000000'}
    />
  </div>
  <p style={styles.hintText}>
    After scanning, enter your password to complete login.
  </p>
</div>
```

#### Mobile版: SignIn.js

QRスキャン結果をパラメータで受け取る：

```jsx
import { useNavigation, useRoute } from '@react-navigation/native'

const route = useRoute()

// QRスキャンからの戻り時にデータを反映
useEffect(() => {
  if (route.params?.qrServerUrl) {
    setServerUrl(route.params.qrServerUrl)
  }
  if (route.params?.qrEmail) {
    setEmail(route.params.qrEmail)
  }
}, [route.params])

// Sign Upボタンの下に追加
<View style={styles.element}>
  <Button
    label="Scan QR Code"
    onPress={() => navigation.navigate('QrScanner')}
    color={colors.grayDark}
    labelColor={colors.white}
  />
</View>
```

#### Mobile版: QrScanner.js（新規作成）

```jsx
// expo-cameraを使用してQRコードをスキャン
// スキャン成功時：
// 1. QRデータをパース { server, email }
// 2. navigation.navigate('SignIn', { qrServerUrl: server, qrEmail: email })
```

### API変更

なし（既存APIで対応可能）
