/**
 * Background refresh: a periodic OS task that runs one POST /api/refresh batch
 * while the app is in the background and optionally posts a local notification
 * about the new articles (per-feed counts and titles, or the article itself
 * when there is just one), plus a separate one for keyword matches.
 *
 * This module must be imported at app startup (src/index.js):
 * `TaskManager.defineTask` has to run at module top level so the definition
 * exists even when the OS wakes the JS runtime only for the task.
 *
 * Rules:
 *   - No React context / Redux. When woken for the task alone, nothing is
 *     mounted, so settings and tokens are read from AsyncStorage.
 *   - Do nothing while the app is in the foreground. The app refreshes itself.
 *   - New-article counts accumulate until they reach the user's threshold, and
 *     are cleared when the app is opened (the articles are shown there).
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import * as BackgroundTask from 'expo-background-task'
import * as Notifications from 'expo-notifications'
import * as TaskManager from 'expo-task-manager'
import { AppState, Platform } from 'react-native'
import { createApiClient } from './api'
import { getAuthToken } from './supabase'
import {
  buildKeywordContent,
  buildSummaryContent,
  compactArticle,
  extractNewArticles,
  findKeywordMatches,
  mergeByFeed,
  mergeItems,
  normalizeKeywords,
} from './newArticleNotifications'

export const BG_REFRESH_TASK = 'feedown.background-refresh'
export const NEW_ARTICLES_NOTIFICATION_TYPE = 'new-articles'
export const THRESHOLD_OPTIONS = [1, 5, 10, 20, 50]
export const DEFAULT_BG_SETTINGS = {
  enabled: false,
  notify: false,
  threshold: 1,
  /** Feeds whose new articles never notify (27c). Default: all feeds notify. */
  mutedFeedIds: [],
  /** Titles containing one of these notify right away (27d). */
  keywords: [],
}

/** Shortest interval we ask the OS for (minutes). The OS decides the real one. */
const MIN_INTERVAL_MINUTES = 15
const ANDROID_CHANNEL = 'new-articles'
/** One notification that is replaced on every update instead of stacking up. */
const NOTIFICATION_ID = 'feedown-new-articles'
/** Keyword matches get their own notification, also replaced on update. */
const KEYWORD_NOTIFICATION_ID = 'feedown-keyword'
/**
 * iOS stops a background run after about 30 s. If the refresh took longer
 * than this, skip the article list and fall back to the plain count.
 */
const LIST_DEADLINE_MS = 15 * 1000
const LIST_LIMIT = 100
const SETTINGS_KEY = '@feedown_bg_refresh_settings'
const STATE_KEY = '@feedown_bg_refresh_state'
const RUN_LOG_KEY = '@feedown_bg_refresh_runs'
const MAX_RUN_LOG = 20

function warn(action, e) {
  console.warn(`[bg-refresh] ${action}: ${e?.message || e}`)
}

async function loadJson(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch (e) {
    warn(`failed to read ${key}`, e)
    return fallback
  }
}

async function saveJson(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (e) {
    warn(`failed to write ${key}`, e)
    return false
  }
}

export function normalizeThreshold(value) {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n) || n < 1) return DEFAULT_BG_SETTINGS.threshold
  return Math.min(n, 999)
}

// Only show notifications in the foreground when they come from the settings
// screen (test notification / check now). Background ones are shown by the OS.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const show = !!notification?.request?.content?.data?.foreground
    return {
      shouldShowBanner: show,
      shouldShowList: show,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }
  },
})

TaskManager.defineTask(BG_REFRESH_TASK, async () => {
  try {
    await runBackgroundRefresh()
    return BackgroundTask.BackgroundTaskResult.Success
  } catch (e) {
    warn('run failed', e)
    return BackgroundTask.BackgroundTaskResult.Failed
  }
})

// ---- settings ---------------------------------------------------------------

export async function loadBgSettings() {
  const stored = await loadJson(SETTINGS_KEY, {})
  const settings = { ...DEFAULT_BG_SETTINGS, ...(stored || {}) }
  return normalizeSettings(settings)
}

function normalizeSettings(settings) {
  return {
    ...settings,
    threshold: normalizeThreshold(settings.threshold),
    mutedFeedIds: Array.isArray(settings.mutedFeedIds)
      ? [...new Set(settings.mutedFeedIds.filter(Boolean))]
      : [],
    keywords: normalizeKeywords(settings.keywords),
  }
}

/** Merge and save settings, then register / unregister the OS task to match. */
export async function updateBgSettings(patch) {
  const next = normalizeSettings({ ...(await loadBgSettings()), ...patch })
  await saveJson(SETTINGS_KEY, next)
  await syncBackgroundTask(next.enabled)
  return next
}

// ---- permission and registration ---------------------------------------------

/** @returns {Promise<'granted'|'undetermined'|'denied'>} */
export async function getNotificationPermission() {
  try {
    const p = await Notifications.getPermissionsAsync()
    if (p.granted) return 'granted'
    return p.canAskAgain ? 'undetermined' : 'denied'
  } catch (e) {
    warn('failed to read notification permission', e)
    return 'denied'
  }
}

/** Ask for permission. If already decided, the OS returns the current state. */
export async function requestNotificationPermission() {
  try {
    const p = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    })
    return !!p.granted
  } catch (e) {
    warn('failed to request notification permission', e)
    return false
  }
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: 'New articles',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  } catch (e) {
    warn('failed to create notification channel', e)
  }
}

/** Register the OS task when enabled, unregister it when disabled. */
export async function syncBackgroundTask(enabled) {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(BG_REFRESH_TASK)
    if (enabled && !registered) {
      await ensureChannel()
      await BackgroundTask.registerTaskAsync(BG_REFRESH_TASK, {
        minimumInterval: MIN_INTERVAL_MINUTES,
      })
    } else if (!enabled && registered) {
      await BackgroundTask.unregisterTaskAsync(BG_REFRESH_TASK)
    }
  } catch (e) {
    warn('failed to update task registration', e)
  }
}

/** Called once at startup so the OS registration matches the saved setting. */
export async function syncBackgroundTaskFromSettings() {
  const settings = await loadBgSettings()
  await syncBackgroundTask(settings.enabled)
}

/** For the settings screen: is the task registered, and is it allowed by the OS? */
export async function getBackgroundTaskStatus() {
  const status = { registered: false, restricted: false }
  try {
    status.registered = await TaskManager.isTaskRegisteredAsync(BG_REFRESH_TASK)
  } catch (e) {
    warn('failed to read task registration', e)
  }
  try {
    status.restricted =
      (await BackgroundTask.getStatusAsync()) ===
      BackgroundTask.BackgroundTaskStatus.Restricted
  } catch (e) {
    warn('failed to read background task status', e)
  }
  return status
}

// ---- notifications -------------------------------------------------------------

/**
 * True when a new-article notification would actually reach the user: the
 * background task is on, notifications are on, and the OS allows them.
 * Drives the bell on the home screen (27e).
 */
export function isDelivering(settings, permission) {
  return !!(settings?.enabled && settings?.notify && permission === 'granted')
}

/**
 * Post (or replace) one of our notifications.
 *
 * @param {string} identifier NOTIFICATION_ID or KEYWORD_NOTIFICATION_ID
 * @param {{title: string, body: string, article?: object}} content
 *   With `article`, tapping opens that article (27b).
 * @param {boolean} foreground also show it while the app is open
 */
async function presentNotification(identifier, content, foreground) {
  await ensureChannel()
  const data = { type: NEW_ARTICLES_NOTIFICATION_TYPE }
  if (content.article?.id) data.article = compactArticle(content.article)
  if (foreground) data.foreground = true
  // Re-posting with the same identifier only updates a delivered notification
  // silently on iOS. Remove the old one first so the update alerts again
  // while still leaving a single notification in the list.
  try {
    await Notifications.dismissNotificationAsync(identifier)
  } catch (e) {
    warn('failed to dismiss previous notification', e)
  }
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: content.title,
      body: content.body,
      sound: 'default',
      data,
    },
    trigger: Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : null,
  })
}

export const TEST_NOTIFICATION_KINDS = ['summary', 'single', 'keyword']

const SAMPLE_ARTICLES = [
  { title: 'A sample headline from your first feed', feedTitle: 'TechCrunch' },
  { title: 'Another story that arrived in this run', feedTitle: 'Hacker News' },
]

/**
 * The newest real article, so a test of the single-article and keyword
 * notifications can be tapped through to ArticleDetail. Falls back to sample
 * text (tapping that opens the article list).
 */
async function sampleArticle() {
  try {
    const res = await createApiClient().articles.list({ limit: 1 })
    const article = res.success ? res.data?.articles?.[0] : null
    if (article?.id) return compactArticle(article)
  } catch (e) {
    warn('failed to load a sample article', e)
  }
  return { ...SAMPLE_ARTICLES[0], id: null }
}

/** Settings screen: show each notification style with sample data. */
export async function sendTestNotification(kind = 'summary') {
  if (kind === 'single') {
    const article = await sampleArticle()
    await presentNotification(
      NOTIFICATION_ID,
      buildSummaryContent({ total: 1, items: [article] }),
      true
    )
  } else if (kind === 'keyword') {
    const article = await sampleArticle()
    const keyword = (await loadBgSettings()).keywords[0] || 'sample'
    await presentNotification(
      KEYWORD_NOTIFICATION_ID,
      buildKeywordContent([{ ...article, keyword }]),
      true
    )
  } else {
    await presentNotification(
      NOTIFICATION_ID,
      buildSummaryContent({
        total: 8,
        byFeed: { a: { title: 'TechCrunch', count: 5 }, b: { title: 'Hacker News', count: 2 } },
        items: SAMPLE_ARTICLES,
      }),
      true
    )
  }
}

// ---- state shared with the foreground app ----------------------------------------

/**
 * Accumulated since the app was last opened:
 *   - `unseen`: new articles fetched in the background (all feeds). The app
 *     reloads its list when this is above 0.
 *   - `notifiable`: the part of `unseen` not from muted feeds. The counted
 *     notification shows this total.
 *   - `pending`: the part of `notifiable` not yet notified. Grows until it
 *     reaches the threshold.
 *   - `items` / `byFeed`: the identified articles (latest MAX_ITEMS) and
 *     per-feed counts, muted feeds excluded, for the notification text.
 *   - `keywordItems`: keyword matches, for the keyword notification.
 */
const EMPTY_STATE = {
  unseen: 0,
  notifiable: 0,
  pending: 0,
  items: [],
  byFeed: {},
  keywordItems: [],
}

async function loadState() {
  const state = await loadJson(STATE_KEY, {})
  const count = (v) => Math.max(0, Number(v) || 0)
  const unseen = count(state?.unseen)
  return {
    unseen,
    // State written by 1.0.15 has no `notifiable`: treat all as notifiable
    notifiable: state && 'notifiable' in state ? count(state.notifiable) : unseen,
    pending: count(state?.pending),
    items: Array.isArray(state?.items) ? state.items : [],
    byFeed: state?.byFeed && typeof state.byFeed === 'object' ? state.byFeed : {},
    keywordItems: Array.isArray(state?.keywordItems) ? state.keywordItems : [],
  }
}

/**
 * Called when the app comes to the foreground. Clears the state and the
 * delivered count notification, and returns how many new articles the
 * background runs fetched so the caller can reload the list.
 *
 * The keyword notification stays in the notification list: it points at a
 * specific article the user asked to be told about, which is easy to miss in
 * a reloaded list.
 */
export async function consumeBackgroundNewArticles() {
  const { unseen } = await loadState()
  await saveJson(STATE_KEY, EMPTY_STATE)
  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_ID)
  } catch (e) {
    warn('failed to dismiss notification', e)
  }
  return unseen
}

/**
 * Listeners in the running app for articles a run fetched after the app came
 * to the foreground mid-run. By then the foreground handler has already
 * consumed the counters, so the app is told directly instead.
 */
const foregroundListeners = new Set()

/** @returns {() => void} unsubscribe */
export function onBackgroundArticles(listener) {
  foregroundListeners.add(listener)
  return () => foregroundListeners.delete(listener)
}

function emitBackgroundArticles(count) {
  foregroundListeners.forEach((listener) => {
    try {
      listener(count)
    } catch (e) {
      warn('background articles listener failed', e)
    }
  })
}

// ---- run log -------------------------------------------------------------------

export async function loadRunLog() {
  const log = await loadJson(RUN_LOG_KEY, [])
  return Array.isArray(log) ? log : []
}

async function recordRun(entry) {
  const log = await loadRunLog()
  await saveJson(RUN_LOG_KEY, [entry, ...log].slice(0, MAX_RUN_LOG))
}

// ---- the refresh run -------------------------------------------------------------

/**
 * One refresh batch. The server allows one POST /api/refresh per 30 s per
 * token (functions/_middleware.ts), so a second batch in the same run would
 * always be rejected. The server picks the least recently fetched feeds
 * first, so successive runs rotate through all feeds. Never throws.
 */
async function refreshOnce() {
  const res = await createApiClient().refresh.refreshAll()
  if (!res.success) {
    if (res.status === 429) return { newArticles: 0, rateLimited: true }
    return { newArticles: 0, error: res.error || 'refresh failed' }
  }
  return { newArticles: res.data?.stats?.newArticles || 0 }
}

/**
 * The articles this run added, from the first page of unread articles.
 * Never throws: on failure or when short on time, returns no articles and the
 * notification falls back to the plain count.
 *
 * #8 (offline cache) can save `articles` here to prefetch the list.
 */
async function fetchNewArticles(startedAt, newArticles) {
  if (Date.now() - startedAt > LIST_DEADLINE_MS) {
    return { found: [], listSkipped: 'slow' }
  }
  try {
    const res = await createApiClient().articles.list({
      unreadOnly: true,
      limit: LIST_LIMIT,
    })
    if (!res.success) return { found: [], listError: res.error || 'list failed' }
    return { found: extractNewArticles(res.data?.articles, startedAt, newArticles) }
  } catch (e) {
    return { found: [], listError: e?.message || String(e) }
  }
}

let running = null

/**
 * One run. Overlapping calls share the same promise.
 *
 * @param {{foreground?: boolean}} [options] true for "Check now" on the
 *   settings screen: ignores the enabled switch and the foreground check,
 *   does not touch the background counters, and shows the notifications in
 *   the foreground for this run's articles.
 */
export function runBackgroundRefresh(options = {}) {
  if (!running) {
    running = check(options)
      .then(async (result) => {
        await recordRun({
          at: Date.now(),
          background: !options.foreground,
          ...result,
        })
        return result
      })
      .finally(() => {
        running = null
      })
  }
  return running
}

async function tryPresent(identifier, content, foreground) {
  if (!content) return false
  try {
    await presentNotification(identifier, content, foreground)
    return true
  } catch (e) {
    warn('failed to post notification', e)
    return false
  }
}

async function check({ foreground = false } = {}) {
  const started = Date.now()
  const settings = await loadBgSettings()
  const done = (fields) => ({ durationMs: Date.now() - started, ...fields })

  if (!foreground && !settings.enabled) return done({ skipped: 'off' })
  if (!foreground && AppState.currentState === 'active') {
    return done({ skipped: 'active' })
  }
  if (!(await getAuthToken())) return done({ skipped: 'signed-out' })

  const { newArticles, rateLimited, error } = await refreshOnce()
  // Refreshed by the app (or another run) within the last 30 s: nothing to add
  if (rateLimited) return done({ skipped: 'rate-limited' })

  const list = newArticles > 0 ? await fetchNewArticles(started, newArticles) : { found: [] }
  // Muted feeds never notify (27c): drop their articles from the text, the
  // threshold count and the keyword check. Only identified ones can be dropped.
  const muted = new Set(settings.mutedFeedIds)
  const visible = list.found.filter((a) => !muted.has(a.feedId))
  const mutedCount = list.found.length - visible.length
  const notifiable = Math.max(0, newArticles - mutedCount)
  const keywordMatches = findKeywordMatches(visible, settings.keywords)

  const canNotify =
    settings.notify && (await getNotificationPermission()) === 'granted'
  const logFields = {
    newArticles,
    ...(newArticles > 0 ? { identified: list.found.length } : {}),
    ...(mutedCount ? { muted: mutedCount } : {}),
    ...(keywordMatches.length ? { keywordMatches: keywordMatches.length } : {}),
    ...(list.listError ? { listError: list.listError } : {}),
    ...(list.listSkipped ? { listSkipped: list.listSkipped } : {}),
    ...(error ? { error } : {}),
  }

  if (foreground) {
    let notified = false
    let keywordNotified = false
    if (canNotify && notifiable > 0 && notifiable >= settings.threshold) {
      notified = await tryPresent(
        NOTIFICATION_ID,
        buildSummaryContent({
          total: notifiable,
          byFeed: mergeByFeed({}, visible),
          items: visible,
        }),
        true
      )
    }
    if (canNotify && keywordMatches.length > 0) {
      keywordNotified = await tryPresent(
        KEYWORD_NOTIFICATION_ID,
        buildKeywordContent(keywordMatches),
        true
      )
    }
    return done({ ...logFields, notified, ...(keywordNotified ? { keywordNotified } : {}) })
  }

  // The app was opened during the run: no notification, but have it reload
  // the list since its foreground check ran before these articles existed
  if (AppState.currentState === 'active') {
    if (newArticles > 0) emitBackgroundArticles(newArticles)
    return done({ ...logFields, skipped: 'active' })
  }

  const state = await loadState()
  state.unseen += newArticles
  state.notifiable += notifiable
  state.items = mergeItems(visible, state.items)
  state.byFeed = mergeByFeed(state.byFeed, visible)
  // With notifications off, don't build up a backlog that would fire at once
  // when they are turned on later
  state.pending = canNotify ? state.pending + notifiable : 0

  let keywordNotified = false
  if (canNotify && keywordMatches.length > 0) {
    // Keyword matches alert right away, regardless of the threshold
    const keywordItems = mergeItems(keywordMatches, state.keywordItems)
    keywordNotified = await tryPresent(
      KEYWORD_NOTIFICATION_ID,
      buildKeywordContent(keywordItems),
      false
    )
    if (keywordNotified) state.keywordItems = keywordItems
  }

  let notified = false
  if (canNotify && state.pending > 0 && state.pending >= settings.threshold) {
    // Show the total since the app was last opened, not just this run
    notified = await tryPresent(
      NOTIFICATION_ID,
      buildSummaryContent({
        total: state.notifiable,
        byFeed: state.byFeed,
        items: state.items,
      }),
      false
    )
    if (notified) state.pending = 0
  }
  await saveJson(STATE_KEY, state)
  return done({ ...logFields, notified, ...(keywordNotified ? { keywordNotified } : {}) })
}
