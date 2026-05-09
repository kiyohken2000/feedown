const MAX_TEXT_LENGTH = 4000

export function buildArticleContext(article, readerContent = null) {
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

  const truncated = text.length > MAX_TEXT_LENGTH
  if (truncated) {
    text = text.slice(0, MAX_TEXT_LENGTH)
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

function djb2Hash(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i)
    hash = hash & hash
  }
  return (hash >>> 0).toString(36)
}
