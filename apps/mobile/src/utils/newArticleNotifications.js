/**
 * Pure helpers for the new-article notifications (BRUSHUP #27): picking the
 * articles a refresh added out of the article list, and building the
 * notification text. No I/O here so the background task and the tests share
 * the same logic.
 *
 * The server's refresh only returns a count, so the device identifies the
 * new articles itself: articles whose `fetchedAt` is at or after the run
 * started. The list is sorted by `publishedAt` and capped at 100, so articles
 * with an old publish date can be missed. The refresh count stays the total;
 * anything not identified is shown as "+N more".
 */

/** Items kept in the background state for the notification text. */
export const MAX_ITEMS = 20
/** Feeds named in the summary line before "+N more". */
const MAX_FEEDS_IN_SUMMARY = 3
/** Article titles listed under the summary line. */
const MAX_TITLES_IN_SUMMARY = 2
/** Allowance for the device and server clocks disagreeing. */
const CLOCK_SKEW_MS = 30 * 1000
/** Keep notification payloads small; ArticleDetail only uses a few fields. */
const MAX_DESCRIPTION = 500

export function newArticlesText(count) {
  return count === 1 ? '1 new article' : `${count} new articles`
}

/** The fields ArticleDetail needs, small enough for a notification payload. */
export function compactArticle(article) {
  return {
    id: article.id,
    title: article.title || '',
    url: article.url || '',
    feedId: article.feedId || null,
    feedTitle: article.feedTitle || '',
    publishedAt: article.publishedAt || null,
    imageUrl: article.imageUrl || null,
    description: (article.description || '').slice(0, MAX_DESCRIPTION),
  }
}

/**
 * The articles a refresh added, newest publish date first.
 *
 * @param {object[]} articles GET /api/articles result
 * @param {number} startedAt when the run started (device clock, ms)
 * @param {number} newArticles the refresh's count; never return more than this
 */
export function extractNewArticles(articles, startedAt, newArticles) {
  if (!Array.isArray(articles) || newArticles <= 0) return []
  const cutoff = startedAt - CLOCK_SKEW_MS
  return articles
    .filter((a) => a && a.id && Date.parse(a.fetchedAt) >= cutoff)
    .slice(0, newArticles)
    .map(compactArticle)
}

// ---- keywords ---------------------------------------------------------------

/** NFKC + lower case, so full-width / half-width and case variants match. */
export function normalizeForMatch(text) {
  return String(text || '').normalize('NFKC').toLowerCase()
}

/** Trimmed, de-duplicated keywords (by normalized form), in the given order. */
export function normalizeKeywords(keywords) {
  const seen = new Set()
  const out = []
  const list = Array.isArray(keywords) ? keywords : []
  list.forEach((k) => {
    const trimmed = String(k || '').trim()
    const key = normalizeForMatch(trimmed)
    if (!key || seen.has(key)) return
    seen.add(key)
    out.push(trimmed)
  })
  return out
}

/** The first keyword found in the title, or null. */
export function matchKeyword(title, keywords) {
  const haystack = normalizeForMatch(title)
  if (!haystack) return null
  return (keywords || []).find((k) => {
    const needle = normalizeForMatch(k).trim()
    return needle && haystack.includes(needle)
  }) || null
}

/** Articles whose titles contain a keyword, tagged with the keyword. */
export function findKeywordMatches(articles, keywords) {
  if (!keywords || keywords.length === 0) return []
  return (articles || []).reduce((out, a) => {
    const keyword = matchKeyword(a.title, keywords)
    if (keyword) out.push({ ...a, keyword })
    return out
  }, [])
}

// ---- accumulated state ----------------------------------------------------------

/** Add this run's articles to the per-feed counts. */
export function mergeByFeed(byFeed, articles) {
  const next = { ...(byFeed || {}) }
  const list = articles || []
  list.forEach((a) => {
    const key = a.feedId || a.feedTitle || 'unknown'
    const prev = next[key] || { title: a.feedTitle || 'Unknown feed', count: 0 }
    next[key] = { title: a.feedTitle || prev.title, count: prev.count + 1 }
  })
  return next
}

/** Newest first, no duplicates, at most `max`. */
export function mergeItems(newer, older, max = MAX_ITEMS) {
  const seen = new Set()
  return [...(newer || []), ...(older || [])]
    .filter((a) => {
      if (!a?.id || seen.has(a.id)) return false
      seen.add(a.id)
      return true
    })
    .slice(0, max)
}

// ---- notification content -----------------------------------------------------------

/**
 * "TechCrunch 5 · Hacker News 3 · +2 more". `total` is the refresh count, so
 * articles that were not identified end up in "+N more".
 */
export function feedSummaryLine(byFeed, total) {
  const feeds = Object.values(byFeed || {})
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count)
  const shown = feeds.slice(0, MAX_FEEDS_IN_SUMMARY)
  const shownCount = shown.reduce((sum, f) => sum + f.count, 0)
  const parts = shown.map((f) => `${f.title} ${f.count}`)
  const rest = Math.max(0, total - shownCount)
  if (rest > 0 && parts.length > 0) parts.push(`+${rest} more`)
  return parts.join(' · ')
}

/**
 * Content for the counted notification.
 *
 * @param {{total: number, byFeed?: object, items?: object[]}} input
 *   `total` new articles since the app was last opened (muted feeds
 *   excluded), with the per-feed counts and latest items identified so far.
 * @returns {{title: string, body: string, article?: object}}
 *   `article` is set when the notification is about a single article (27b).
 */
export function buildSummaryContent({ total, byFeed, items }) {
  const list = items || []
  // 27b: exactly one article, and we know which
  if (total === 1 && list.length === 1) {
    const article = list[0]
    return {
      title: article.feedTitle || 'FeedOwn',
      body: article.title || newArticlesText(1),
      article,
    }
  }
  const summary = feedSummaryLine(byFeed, total)
  // Nothing identified (list fetch failed or skipped): the 1.0.15 text
  if (!summary) return { title: 'FeedOwn', body: newArticlesText(total) }
  const titles = list
    .slice(0, MAX_TITLES_IN_SUMMARY)
    .map((a) => `• ${a.title}`)
  return {
    title: `FeedOwn — ${newArticlesText(total)}`,
    body: [summary, ...titles].join('\n'),
  }
}

/** Content for the keyword notification (27d). `matches` newest first. */
export function buildKeywordContent(matches) {
  if (!matches || matches.length === 0) return null
  if (matches.length === 1) {
    const m = matches[0]
    return {
      title: `“${m.keyword}” · ${m.feedTitle || 'FeedOwn'}`,
      body: m.title,
      article: m,
    }
  }
  const keywords = normalizeKeywords(matches.map((m) => m.keyword))
  return {
    title: `FeedOwn — ${matches.length} keyword matches`,
    body: [
      keywords.map((k) => `“${k}”`).join(' · '),
      ...matches.slice(0, MAX_TITLES_IN_SUMMARY).map((m) => `• ${m.title}`),
    ].join('\n'),
  }
}
