# Blocked Feeds — Investigation & Workarounds

Cloudflare Workers/Pages Functions の無料枠は固定 IP レンジ（`173.245.48.0/20` 等）からアウトバウンドリクエストを送信する。
一部の学術出版社はこの IP レンジを意図的にブロックしているため、RSS 取得が HTTP 403 で失敗する。

---

## 現在登録されているフィードの状態（2026-04 調査）

### ブロック中（ACS — Cloudflare IP ブロック）

| 元の RSS URL | ジャーナル名 | PubMed 検索クエリ | NlmUniqueID | PubMed RSS URL |
|---|---|---|---|---|
| `...jc=jmcmar` | Journal of Medicinal Chemistry | `"J Med Chem"[Journal]` | 9716531 | `https://pubmed.ncbi.nlm.nih.gov/rss/journals/9716531/?limit=20` |
| `...jc=jcisd8` | J. Chem. Inf. and Modeling | `"J Chem Inf Model"[Journal]` | 101230060 | `https://pubmed.ncbi.nlm.nih.gov/rss/journals/101230060/?limit=20` |
| `...jc=amclct` | ACS Medicinal Chemistry Letters | `"ACS Med Chem Lett"[Journal]` | 101521073 | `https://pubmed.ncbi.nlm.nih.gov/rss/journals/101521073/?limit=20` |
| `...jc=abmcb8` | ACS Chemical Biology | `"ACS Chem Biol"[Journal]` | 101282906 | `https://pubmed.ncbi.nlm.nih.gov/rss/journals/101282906/?limit=20` |

> 完全な元 URL: `https://pubs.acs.org/action/showFeed?type=axatoc&feed=rss&jc={code}`

### ブロック中（Nature — Cloudflare IP ブロック）

| 元の RSS URL | ジャーナル名 | PubMed 検索クエリ | NlmUniqueID | PubMed RSS URL |
|---|---|---|---|---|
| `feeds.nature.com/clpt/rss/aop` | Clinical Pharmacology & Therapeutics | `"Clin Pharmacol Ther"[Journal]` | 0372741 | `https://pubmed.ncbi.nlm.nih.gov/rss/journals/0372741/?limit=20` |

### ブロック中（Oxford Journals — Cloudflare IP ブロック）

Oxford Journals は `oxfordjournals.org` から `academic.oup.com` に移行済みだが、
新 URL (`academic.oup.com/*/rss/advance-articles`) も Cloudflare から 403 が返る。

| 元の RSS URL | ジャーナル名 | PubMed 検索クエリ | NlmUniqueID | PubMed RSS URL |
|---|---|---|---|---|
| `nar.oxfordjournals.org/rss/ahead.xml` | Nucleic Acids Research | `"Nucleic Acids Res"[Journal]` | 0411011 | `https://pubmed.ncbi.nlm.nih.gov/rss/journals/0411011/?limit=20` |
| `bioinformatics.oxfordjournals.org/rss/ahead.xml` | Bioinformatics (Oxford, England) | `"Bioinformatics Oxford England"[Journal]` | 9808944 | `https://pubmed.ncbi.nlm.nih.gov/rss/journals/9808944/?limit=20` |

---

### 廃止フィード（URL そのものが無効、削除推奨）

| フィード URL | HTTP | 状況 | 代替 |
|---|---|---|---|
| `feeds.nature.com/msb/rss/current` | 404 | Mol. Syst. Biol. が EMBO Press に移転 | PubMed: `"Mol Syst Biol"[Journal]` / NlmUID: 101235389 |
| `www3.interscience.wiley.com/rss/journal/34185` | 403 | Wiley InterScience 2012 年廃止。後継 Wiley Online Library に移行済みだが journal ID 34185 はマッピング不明 | 元のジャーナル名を確認の上 PubMed で検索 |
| `feedity.com/frontiersin-org/UFZXVVdQ.rss` | 404 | feedity.com サービス廃止 | Frontiers の各ジャーナルから直接 RSS を取得（`frontiersin.org`） |
| `narcolepsynetwork.org/feed/` | 403 | サイト設定変更と推測（患者団体サイト） | サイトで公開 RSS を再確認 |
| `chemblogs.com/sial_blog/...` | 404 | ブログ廃止 | — |
| `boundtodreams.blogspot.com/feeds/posts/default` | 404 | ブログ削除 | — |
| `nemunemu528.blog.fc2.com/?xml` | 404 | ブログ削除 | — |
| `www.ferrergrupo.com/FerrerGrupo.xml` | 530 | Cloudflare 経由でホスト障害 | — |
| `mrss.dokoda.jp/...healthdayjapan...` | 530 | サービス障害 | — |

---

## 検証方法

```bash
# ローカル（非 Cloudflare IP）からは 200 が返る → URL は正しい、IP ブロックが原因
curl -s -o /dev/null -w "%{http_code}" \
  -H "User-Agent: Mozilla/5.0 (compatible; FeedOwn/1.0)" \
  "https://pubs.acs.org/action/showFeed?type=axatoc&feed=rss&jc=jmcmar"
# → 200

# Cloudflare Worker から wrangler tail で確認
# → [Queue] HTTP 403 for https://pubs.acs.org/...
```

User-Agent を変更しても 403 は解消されない（IP レベルのブロック）。

---

## 回避策

### 推奨: PubMed RSS に置き換える

PubMed（NIH/NCBI サーバー）が提供する RSS は Cloudflare にブロックされない。
論文収録は出版後数時間以内。内容（タイトル・著者・アブストラクト・DOI リンク）はジャーナル直接 RSS と同等。

**方法 A — NlmUniqueID を使った直接 URL（推奨）**

上記テーブルの「PubMed RSS URL」列の URL をそのまま FeedOwn に登録する。
ジャーナル名検索より確実（同名誌の誤マッチを防ぐ）。

**方法 B — PubMed サイトで検索して RSS を生成**

1. [https://pubmed.ncbi.nlm.nih.gov/](https://pubmed.ncbi.nlm.nih.gov/) を開く
2. 上記テーブルの「PubMed 検索クエリ」を入力して検索
3. 右上の **Create RSS** をクリック
4. Number of items: 20 程度に設定 → **Create RSS** → URL をコピー
5. FeedOwn の該当フィードを削除し、コピーした URL で再登録

---

### 代替案: Deno Deploy ミニプロキシ（汎用）

PubMed に収録されていないフィードや、将来ブロックが増えた場合の汎用策。
Deno Deploy は Google Cloud Platform で動作しており、ACS には IP ブロックされていない（2026-04 時点）。
**無料枠**: 月 100 万リクエスト、100 GB

**proxy コード** (`main.ts`):

```typescript
const ALLOWED_HOSTS = [
  'pubs.acs.org',
  'feeds.nature.com',
  'www.nature.com',
  'academic.oup.com',
];

Deno.serve(async (req) => {
  const feedUrl = new URL(req.url).searchParams.get('url');
  if (!feedUrl) return new Response('Missing url', { status: 400 });

  let host: string;
  try {
    host = new URL(feedUrl).hostname;
  } catch {
    return new Response('Invalid URL', { status: 400 });
  }

  if (!ALLOWED_HOSTS.includes(host)) {
    return new Response('Forbidden', { status: 403 });
  }

  const res = await fetch(feedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FeedOwn/1.0; +https://github.com/kiyohken2000/feedown)',
      'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
    },
  });

  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': 'application/xml' },
  });
});
```

**デプロイ手順**:
1. [https://deno.com/deploy](https://deno.com/deploy) でアカウント作成
2. New Project → 上記コードを貼り付けて Deploy
3. FeedOwn のフィード URL を以下形式に変更:
   `https://your-project.deno.dev/?url=https://pubs.acs.org/action/showFeed?...`

---

### その他の選択肢（参考）

| 方法 | 無料枠 | 欠点 |
|---|---|---|
| **Kill the Newsletter** (killthenwsletter.com) | 無料 | ACS メールアラートの購読登録が別途必要。メール送信タイミング依存 |
| **Vercel Serverless Function** | 月 10 万実行 | Deno Deploy より設定が複雑 |
| **GitHub Actions + Gist** | 月 2000 分 | cronの間隔分の遅延（最大15分）。設定が複雑 |

---

---

## 正常動作中のフィード（2026-04 調査）

### ScienceDirect（Elsevier）

| RSS URL (ISSN) | ジャーナル名 | PubMed 略称 | NlmUniqueID |
|---|---|---|---|
| `.../09680896` (0968-0896) | Bioorganic & Medicinal Chemistry | Bioorg Med Chem | 9413298 |
| `.../0960894X` (0960-894X) | Bioorganic & Medicinal Chemistry Letters | Bioorg Med Chem Lett | 9107377 |
| `.../13596446` (1359-6446) | Drug Discovery Today | Drug Discov Today | 9604391 |
| `.../01656147` (0165-6147) | Trends in Pharmacological Sciences | Trends Pharmacol Sci | 7906158 |
| `.../00796468` (0079-6468) | Progress in Medicinal Chemistry | Prog Med Chem | 0376452 |
| `.../00657743` (0065-7743) | Annual Reports in Medicinal Chemistry | Annu Rep Med Chem | 0257576 |
| `.../24523100` (2452-3100) | Current Opinion in Systems Biology | Curr Opin Syst Biol | 101698476 |

> RSS URL フォーマット: `http://rss.sciencedirect.com/publication/science/{ISSN（ハイフンなし）}`
> ScienceDirect フィードは Cloudflare から正常に取得可能（2026-04 時点）。

### Nature Portfolio

| RSS URL | ジャーナル名 | PubMed 略称 | NlmUniqueID |
|---|---|---|---|
| `feeds.nature.com/nchembio/rss/aop` | Nature Chemical Biology | Nat Chem Biol | 101231976 |
| `feeds.nature.com/nm/rss/aop` | Nature Medicine | Nat Med | 9502015 |
| `feeds.nature.com/nrd/rss/aop` | Nature Reviews Drug Discovery | Nat Rev Drug Discov | 101124171 |
| `nature.com/nchem/.../rss.rdf` | Nature Chemistry | Nat Chem | 101499734 |

> `feeds.nature.com/{code}/rss/aop` 形式は Cloudflare から正常に取得可能。
> ブロックされる `feeds.nature.com/clpt/rss/aop`（Clin. Pharmacol. Ther.）とは別系統。

### RSC（Royal Society of Chemistry）

| RSS URL | ジャーナル名 | PubMed 略称 | NlmUniqueID |
|---|---|---|---|
| `feeds.rsc.org/rss/md` | RSC Medicinal Chemistry（旧 MedChemComm） | Medchemcomm | 101531525 |

### PubMed RSS（登録済み）

| RSS URL | ジャーナル名 | NlmUniqueID |
|---|---|---|
| `pubmed.ncbi.nlm.nih.gov/rss/journals/9716531/` | Journal of Medicinal Chemistry | 9716531 |

### ClinicalTrials.gov

| RSS URL | 内容 |
|---|---|
| `clinicaltrials.gov/ct2/results/rss.xml?...term=narcolepsy` | ナルコレプシー関連臨床試験（直近 14 日更新分） |

### ブログ（fc2）

| RSS URL | タイトル | 備考 |
|---|---|---|
| `medicinalchemistry.blog120.fc2.com/?xml` | メドケム日記 | 記事フィード |
| `medicinalchemistry.blog120.fc2.com/?xml&comment` | メドケム日記 | コメントフィード（記事フィードと重複登録） |
| `medicinalchemistry.blog120.fc2.com/?xml&trackback` | メドケム日記 | トラックバックフィード（記事フィードと重複登録） |
| `pharmachem.blog.fc2.com/?xml` | つれづれと雑記 | 記事フィード |

---

## 関連 Issue

- [kiyohken2000/feedown#2](https://github.com/kiyohken2000/feedown/issues/2) — Cloudflare 50 subrequest limit と IP ブロック問題の報告
