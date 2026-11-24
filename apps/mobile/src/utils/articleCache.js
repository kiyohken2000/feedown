/**
 * Offline copy of the home article list (BRUSHUP #8, phase 1).
 *
 * The app shows it at startup until the first fetch finishes, and instead of
 * an error when the fetch fails. Background refresh adds the unread articles
 * it fetched, so a list opened offline after a run includes them.
 *
 * Plain AsyncStorage, no React: background runs use it with nothing mounted.
 * The cache belongs to one account on one server; reading it as anyone else
 * returns nothing. No function here throws.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getServerUrl, getUser } from './supabase'

const CACHE_KEY = '@feedown_articles_cache'
const VERSION = 1
/** Articles kept: the first page and a half of the home list. */
export const MAX_CACHED_ARTICLES = 100
/** Long descriptions are cut to keep the entry small (Android limits one entry to ~2 MB). */
const MAX_DESCRIPTION = 2000

function warn(action, e) {
  console.warn(`[article-cache] ${action}: ${e?.message || e}`)
}

/** Who is signed in, or null when nobody is. */
async function currentOwner() {
  const [serverUrl, user] = await Promise.all([getServerUrl(), getUser()])
  const userId = user?.uid || user?.id || null
  return userId ? { serverUrl: serverUrl || '', userId } : null
}

function isOwnedBy(cache, owner) {
  return (
    !!cache &&
    !!owner &&
    cache.v === VERSION &&
    cache.serverUrl === owner.serverUrl &&
    cache.userId === owner.userId &&
    Array.isArray(cache.articles)
  )
}

function compact(article) {
  const description = article.description || ''
  return description.length > MAX_DESCRIPTION
    ? { ...article, description: description.slice(0, MAX_DESCRIPTION) }
    : article
}

async function readRaw() {
  const raw = await AsyncStorage.getItem(CACHE_KEY)
  return raw ? JSON.parse(raw) : null
}

/**
 * The cached list for the signed-in account.
 *
 * @returns {Promise<{articles: object[], syncedAt: number, savedAt: number} | null>}
 *   `syncedAt`: when the server last provided these articles.
 */
export async function loadArticleCache() {
  try {
    const [cache, owner] = await Promise.all([readRaw(), currentOwner()])
    if (!isOwnedBy(cache, owner)) return null
    return {
      articles: cache.articles,
      syncedAt: cache.syncedAt || cache.savedAt || 0,
      savedAt: cache.savedAt || 0,
    }
  } catch (e) {
    warn('failed to read', e)
    return null
  }
}

/**
 * Replace the cache with the app's current list.
 *
 * @param {object[]} articles with `isRead` set to the current read state
 * @param {number} syncedAt when the list was last fetched from the server
 * @returns {Promise<boolean>} saved
 */
export async function saveArticleCache(articles, syncedAt) {
  try {
    const owner = await currentOwner()
    if (!owner) return false
    const now = Date.now()
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        v: VERSION,
        ...owner,
        savedAt: now,
        syncedAt: syncedAt || now,
        articles: (articles || []).slice(0, MAX_CACHED_ARTICLES).map(compact),
      })
    )
    return true
  } catch (e) {
    warn('failed to save', e)
    return false
  }
}

/**
 * `incoming` replaces cached articles with the same id, the rest are added;
 * newest publish date first, at most `max`.
 *
 * @returns {{articles: object[], added: number}}
 */
export function mergeArticles(cached, incoming, max = MAX_CACHED_ARTICLES) {
  const byId = new Map()
  ;(cached || []).forEach((a) => {
    if (a?.id) byId.set(a.id, a)
  })
  let added = 0
  ;(incoming || []).forEach((a) => {
    if (!a?.id) return
    if (!byId.has(a.id)) added += 1
    byId.set(a.id, compact(a))
  })
  const time = (a) => Date.parse(a.publishedAt) || 0
  const articles = [...byId.values()].sort((a, b) => time(b) - time(a)).slice(0, max)
  return { articles, added }
}

/**
 * Background prefetch: add the unread articles a refresh run fetched.
 *
 * Only updates an existing cache of the signed-in account. Without one it does
 * nothing, so a list of unread articles alone never becomes the cache.
 *
 * @returns {Promise<number>} articles that were not in the cache before
 */
export async function mergeIntoArticleCache(unreadArticles) {
  try {
    if (!Array.isArray(unreadArticles) || unreadArticles.length === 0) return 0
    const [cache, owner] = await Promise.all([readRaw(), currentOwner()])
    if (!isOwnedBy(cache, owner)) return 0
    const { articles, added } = mergeArticles(cache.articles, unreadArticles)
    const now = Date.now()
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...cache, savedAt: now, syncedAt: now, articles })
    )
    return added
  } catch (e) {
    warn('failed to merge', e)
    return 0
  }
}

export async function clearArticleCache() {
  try {
    await AsyncStorage.removeItem(CACHE_KEY)
  } catch (e) {
    warn('failed to clear', e)
  }
}
