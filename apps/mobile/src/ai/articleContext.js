const DEFAULT_MAX_TEXT_LENGTH = 4000

export function buildArticleContext(article, readerContent = null, maxTextLength = DEFAULT_MAX_TEXT_LENGTH) {
  let text = ''
  let contentSource = 'metadata'

  if (readerContent?.content) {
    text = stripHtml(readerContent.content)
    contentSource = 'reader'
  } else if (article.description) {
    text = stripHtml(article.description)
    contentSource = 'rss'
  } else {
    text = article.title ?? ''
    contentSource = 'metadata'
  }

  text = normalizeWhitespace(text)

  const limit = typeof maxTextLength === 'number' && maxTextLength > 0 ? maxTextLength : DEFAULT_MAX_TEXT_LENGTH
  const truncated = text.length > limit
  if (truncated) {
    text = text.slice(0, limit)
  }

  const contentHash = djb2Hash(text)

  return {
    articleId: article.id,
    title: article.title ?? '',
    feedTitle: article.feedTitle ?? null,
    url: article.url ?? null,
    publishedAt: article.publishedAt ?? null,
    contentSource,
    contentHash,
    text,
    truncated,
  }
}

function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // ブロックタグは段落区切り (\n\n) に変換してから残りタグを除去する。
    // これをやらないと <p>...</p><p>...</p> が一続きの 1 行に collapse して、
    // 下流の truncateForRetry が段落分解できず raw slice fallback になる。
    // useArticleTranslation.extractBlocks と同じパターン。
    .replace(
      /<\/?(p|h[1-6]|li|blockquote|div|article|section|header|footer|br\s*\/?)(\s[^>]*)?>|<br\s*\/?>/gi,
      '\n\n',
    )
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function normalizeWhitespace(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// short retry 用の段落境界 truncate。1st generate が context overflow 等で
// 失敗した時に呼ばれる。raw slice だと記事末尾の結論部が完全に落ちるが、
// この関数は冒頭 (lead 1200 chars 程度) + 末尾段落 (~300 chars) を
// [...] セパレータで結合して両端を残す。論文・社説など結論が末尾の記事で
// 効く。段落 2 個以下の記事は fallback で raw slice。
export function truncateForRetry(text, targetChars = 1500) {
  if (!text || text.length <= targetChars) return text

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  // 段落が少ない記事は構造を活かせないので素直に slice
  if (paragraphs.length < 3) return text.slice(0, targetChars)

  const SEPARATOR = '\n\n[...]\n\n'
  const TAIL_BUDGET = 300
  const LEAD_BUDGET = targetChars - TAIL_BUDGET - SEPARATOR.length

  // Lead: 先頭から段落を greedy に詰める
  const lead = []
  let leadLen = 0
  let leadIdx = 0
  while (leadIdx < paragraphs.length) {
    const p = paragraphs[leadIdx]
    const addLen = p.length + (lead.length > 0 ? 2 : 0)
    if (leadLen + addLen > LEAD_BUDGET) break
    lead.push(p)
    leadLen += addLen
    leadIdx += 1
  }

  // 先頭段落が巨大で 1 個も入らない場合は raw slice fallback
  if (lead.length === 0) return text.slice(0, targetChars)

  // Lead で全段落カバーした (= もう tail に追加するものがない)
  if (leadIdx >= paragraphs.length) return lead.join('\n\n')

  // Tail: 末尾から段落を greedy に詰める (lead と重ならない範囲のみ)
  const tail = []
  let tailLen = 0
  for (let i = paragraphs.length - 1; i >= leadIdx; i -= 1) {
    const p = paragraphs[i]
    const addLen = p.length + (tail.length > 0 ? 2 : 0)
    if (tailLen + addLen > TAIL_BUDGET) {
      // 末尾段落 1 つが TAIL_BUDGET を超える場合は、その段落の末尾部分を
      // 切り出して使う (結論の最後の数文を救う)
      if (tail.length === 0 && i === paragraphs.length - 1) {
        const sliceLen = Math.max(0, TAIL_BUDGET - 3)
        if (sliceLen > 0) tail.unshift('...' + p.slice(-sliceLen))
      }
      break
    }
    tail.unshift(p)
    tailLen += addLen
  }

  if (tail.length === 0) return lead.join('\n\n')
  return lead.join('\n\n') + SEPARATOR + tail.join('\n\n')
}

function djb2Hash(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i)
    hash = hash & hash
  }
  return (hash >>> 0).toString(36)
}
