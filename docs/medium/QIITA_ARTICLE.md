# Feedlyがいつか終わるのが怖いので、月額0円で動くRSSリーダーを自作した

## TL;DR

- Pocketのサービス終了をきっかけに、セルフホスト型RSSリーダー「FeedOwn」を作った
- **Cloudflare Pages + Supabase** で月額0円運用
- Web + iOS + Android対応、リーダーモード・ダークモード搭載
- OSSとして公開中：https://github.com/kiyohken2000/feedown

![FeedOwn メイン画面]()
<!-- 画像: web_app_2.png -->

## なぜ作ったのか

### Pocketの死

2025年、Pocketが正式にサービスを終了した。2007年から存在し、Mozillaに買収されたあのPocketが。

私自身はPocketをそこまで使っていなかったが、このニュースは予想以上に心に刺さった。Pocket自体の問題ではない。**オープンウェブの一部がまた死んでいく**——それが問題だった。

### 15年以上RSSを使い続けて

私は15年以上RSSリーダーを使い続けている。始まりは2008年のGoogle Reader。毎朝コーヒーを片手に開いて、テックブログやニュースをチェックしていた。

そして2013年7月1日——GoogleがReaderを殺した日がやってきた。何百万人もの人と同様に、私はFeedlyに移行した。

でも、わかっている。**RSSは死にかけている**。若い世代はRSSが何かを知らない。

### 恐怖が出発点

Pocketの終了後、考え始めた。**Feedlyが終わったらどうする？**

これらのサービスは慈善事業ではない——利益を出す必要があるビジネスだ。そしてRSSリーダー市場は、決して成長産業ではない。

自分がコントロールできないサービスに完全に依存している。何年もかけてキュレーションしたフィード購読、長年の読書習慣——すべてが、たった一つのサービス終了のお知らせで消え去る可能性がある。

その恐怖がFeedOwnの出発点になった。

### マストドンからの着想

そんなとき、頭に浮かんだのが**マストドン**だった。

マストドンは分散型SNSで、Twitterのような中央集権型サービスとは違い、誰でも自分のサーバー（インスタンス）を立てられる。運営会社が倒産しても、自分のインスタンスは動き続ける。

「RSSリーダーでも同じことができるんじゃないか？」

そう考えて作り始めたのがFeedOwnだ。

## FeedOwnとは

**FeedOwn**は、マストドンのように自分のインフラにデプロイできるセルフホスト型RSSリーダー。

- サブスクリプション料金なし
- 倒産するかもしれない会社なし
- 何を読むべきか決めるアルゴリズムなし
- **自分のデータは自分で管理**

## 主な機能

### クロスプラットフォーム対応

Web + iOS + Androidで動作し、すべてのデバイス間で同期される。

**Web版**

![Web記事一覧]()
<!-- 画像: web_app_2.png -->

**モバイル版**

![Mobile記事一覧]()
<!-- 画像: mobile_ss_articles1.png -->

### ログイン・サインアップ

シンプルでクリーンな認証画面。

**Web版ログイン**

![Webログイン]()
<!-- 画像: web_app_1.png -->

**モバイル版ログイン**

![Mobileログイン]()
<!-- 画像: mobile_ss_login1.png -->

**モバイル版サインアップ**

![Mobileサインアップ]()
<!-- 画像: mobile_ss_signup1.png -->

### リーダーモード

Safari ReaderやPocketのように、広告やサイドバーなしでクリーンな読書体験を提供。

**記事詳細**

![記事詳細]()
<!-- 画像: mobile_ss_article1.png -->

**リーダーモード**

![リーダーモード]()
<!-- 画像: mobile_ss_reader1.png -->

### ダークモード

深夜の読書にも優しい。2026年だからね。

**ライトモード**

![ライトモード]()
<!-- 画像: mobile_ss_articles1.png -->

**ダークモード**

![ダークモード]()
<!-- 画像: mobile_ss_articles2.png -->

### フィード管理

URLでフィードを追加したり、おすすめフィードから始めたり。

**Web版フィード管理**

![Webフィード]()
<!-- 画像: web_app_4.png -->

**モバイル版フィード管理**

![Mobileフィード]()
<!-- 画像: mobile_ss_feeds.png -->

### お気に入り

後で読み返したい記事を保存。Pocketと違って、自分のDBに永続化される。

![お気に入り]()
<!-- 画像: web_app_5.png -->

### 設定

テーマ切り替え、フォントサイズ変更、アカウント管理など。

**Web版設定**

![Web設定]()
<!-- 画像: web_app_6.png -->

**モバイル版設定**

![Mobile設定]()
<!-- 画像: mobile_ss_settings1.png -->

## 技術スタック

![アーキテクチャ図]()
<!-- 画像: architecture_diagram.png -->

| レイヤー | 技術 |
|---------|------|
| Frontend (Web) | Vite + React |
| Frontend (Mobile) | Expo + React Native |
| Backend API | Cloudflare Pages Functions |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |

## なぜこの構成なのか

### Cloudflare Pages Functions

従来のサーバー（Express、FastAPIなど）を動かす代わりに、**Cloudflare Pages Functions**を使っている。

**メリット：**
- **コールドスタートなし**：AWS Lambdaと違い、瞬時に起動
- **グローバル分散**：世界300以上のデータセンターで実行
- **寛大な無料枠**：1日10万リクエストまで無料
- **Pagesと統合**：フロントエンドとバックエンドを一緒にデプロイ

### なぜSupabaseを選んだか（Firebase比較）

当初はFirebase/Firestoreで構築していたが、Supabaseに移行した。

| 観点 | Firebase Firestore | Supabase PostgreSQL |
|------|-------------------|---------------------|
| 課金 | 読み取り/書き込み操作ごと | ストレージ + 帯域幅 |
| 無料枠 | 5万読み取り/日、2万書き込み/日 | **操作数制限なし** |
| クエリ | 限定的（NoSQL） | フルSQL |
| JOIN | サポートなし | ネイティブサポート |
| セルフホスト | 不可能 | 完全にセルフホスト可能 |

RSSリーダーは多くの読み取りを行うため、Firestoreの操作ごとの課金は懸念材料だった。

## コスト分析：本当に月額0円

| サービス | 無料枠 | 実際の使用量 | コスト |
|---------|--------|------------|------|
| Cloudflare Pages | 10万リクエスト/日 | 約1,000/日 | $0 |
| Supabase | 500MB DB、5万認証ユーザー | 約10MB、1ユーザー | $0 |
| **合計** | | | **$0** |

10人のユーザーがいても無料枠内に収まる。

## 実装のポイント

### RSSの直接取得

当初は別のCloudflare WorkerをRSSプロキシとして使っていた。ブラウザはCORSでクロスオリジンのRSSリクエストをブロックするため。

しかしPages Functionsは**サーバーサイド**で動作する。CORSの問題なくRSSを直接取得できる。

```typescript
// functions/api/refresh.ts
export async function onRequestPost(context: any): Promise<Response> {
  // ユーザーのフィードをDBから取得
  const { data: feeds } = await supabase
    .from('feeds')
    .select('*')
    .eq('user_id', uid);

  // 各RSSフィードを直接取得
  for (const feed of feeds) {
    const rssResponse = await fetch(feed.url, {
      headers: { 'User-Agent': 'FeedOwn/1.0' },
    });
    const xmlText = await rssResponse.text();

    // RSS/Atom/RDFをパース
    const parsedFeed = await parseRssXml(xmlText);

    // 新着記事を保存
    await storeArticles(uid, feed.id, parsedFeed.items);
  }

  return Response.json({ success: true });
}
```

### RSSフォーマットの罠

RSSには3つの主要フォーマットがある：

1. **RSS 2.0**：`<item>`が`<channel>`の中
2. **Atom**：`<entry>`が`<feed>`の中
3. **RSS 1.0 (RDF)**：`<item>`が`<channel>`の**外側**（これに気づくまで時間がかかった）

```typescript
async function parseRssXml(xmlText: string) {
  const isAtom = xmlText.includes('xmlns="http://www.w3.org/2005/Atom"');
  const isRdf = xmlText.includes('<rdf:RDF');

  if (isAtom) {
    return parseAtomFeed(xmlText);
  } else if (isRdf) {
    return parseRdfFeed(xmlText);  // itemがchannelの外にある！
  } else {
    return parseRss2Feed(xmlText);
  }
}
```

### リーダーモードの実装

Safari ReaderやPocketのような記事本文抽出機能を実装。

```typescript
// functions/api/article-content.ts
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';

export async function onRequestGet(context: any): Promise<Response> {
  const url = new URL(context.request.url).searchParams.get('url');

  const response = await fetch(url);
  const html = await response.text();

  // linkedomでパース（jsdomはWorkersで動作しない）
  const { document } = parseHTML(html);

  // MozillaのReadabilityで記事を抽出
  const reader = new Readability(document);
  const article = reader.parse();

  return Response.json({
    title: article.title,
    content: article.content,  // クリーンなHTML
  });
}
```

**注意**：`jsdom`はNode.js依存があり、Cloudflare Workersでは動作しない。`linkedom`を使う。

## モバイル実装の工夫

### Expo + React Native

モバイルアプリはExpoで構築している。EAS Buildを使えば、ローカルにXcodeやAndroid Studioがなくてもクラウドでビルドできる。

```bash
# iOS/Androidビルド
eas build --profile production --platform all
```

### セルフホスト対応：動的サーバーURL

FeedOwnはセルフホスト可能なので、モバイルアプリは**任意のサーバーURL**に接続できる必要がある。

ログイン画面でサーバーURLを入力し、AsyncStorageに保存する設計にした。

```javascript
// サーバーURLをAsyncStorageに保存
await AsyncStorage.setItem('@feedown_server_url', serverUrl);

// API呼び出し時に動的に取得
const serverUrl = await AsyncStorage.getItem('@feedown_server_url');
const response = await fetch(`${serverUrl}/api/articles`);
```

### トークン自動リフレッシュ

Supabaseのアクセストークンは約1時間で期限切れになる。モバイルアプリでは、401エラー時に自動でトークンをリフレッシュしてリトライする仕組みを実装した。

```javascript
class ApiClient {
  async request(endpoint, options = {}, isRetry = false) {
    const token = await getAuthToken();
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: { 'Authorization': `Bearer ${token}` }
    });

    // 401エラーかつ初回なら、トークンをリフレッシュしてリトライ
    if (response.status === 401 && !isRetry) {
      const newToken = await this.refreshToken();
      if (newToken) {
        return this.request(endpoint, options, true);
      }
    }
    return response;
  }
}
```

これにより、ユーザーは長時間アプリを開いたままでも再ログイン不要になった。

### リーダーモードのHTML描画

モバイルでリーダーモードを実装するために`react-native-render-html`を使用。サーバーから取得したクリーンなHTMLをネイティブコンポーネントとしてレンダリングする。

```javascript
import RenderHtml from 'react-native-render-html';

function ArticleReader({ content }) {
  const { width } = useWindowDimensions();

  return (
    <RenderHtml
      contentWidth={width - 32}
      source={{ html: content }}
      tagsStyles={{
        p: { fontSize: 17, lineHeight: 28 },
        img: { maxWidth: '100%' },
      }}
    />
  );
}
```

## セルフホスティング

セットアップは約10分で完了する。

**Supabaseダッシュボード**

![Supabase設定]()
<!-- 画像: supabase_dashboard_1.png -->

**Cloudflareダッシュボード**

![Cloudflare設定]()
<!-- 画像: cloudflare_dashboard_1.png -->

**手順：**

1. Supabaseプロジェクト作成（5分）
2. Cloudflare Pagesプロジェクト作成（5分）
3. コードをデプロイ

サーバー管理なし。Dockerなし。月額0円。

## 試してみる

**公開インスタンス（セルフホスト不要）：**

- Web: https://feedown.pages.dev
- iOS: [App Store](https://apps.apple.com/us/app/feedown/id6757896656)
- Android: [Google Play](https://play.google.com/store/apps/details?id=net.votepurchase.feedown)

**セルフホストしたい場合：**

- GitHub: https://github.com/kiyohken2000/feedown

## まとめ

FeedOwnを構築して学んだのは、サーバーレスは「おもちゃプロジェクト専用」ではないということ。適切なアーキテクチャがあれば、**運用コストゼロで実用的なアプリケーションを構築できる**。

RSSが復活するとは思っていない。でも、商用サービスがいつか終了したときに、まだRSSを使っている私たちが取り残されないようにしたかった。

その日が来ても、私はまだ自分のフィードを持っている。

---

**リンク：**
- GitHub: https://github.com/kiyohken2000/feedown
- Web: https://feedown.pages.dev
- App Store: https://apps.apple.com/us/app/feedown/id6757896656
- Google Play: https://play.google.com/store/apps/details?id=net.votepurchase.feedown
