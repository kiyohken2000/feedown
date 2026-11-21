/**
 * Background refresh: a periodic OS task that runs one POST /api/refresh batch
 * while the app is in the background and optionally posts a local "N new articles"
 * notification.
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

export const BG_REFRESH_TASK = 'feedown.background-refresh'
export const NEW_ARTICLES_NOTIFICATION_TYPE = 'new-articles'
export const THRESHOLD_OPTIONS = [1, 5, 10, 20, 50]
export const DEFAULT_BG_SETTINGS = {
  enabled: false,
  notify: false,
  threshold: 1,
}

/** Shortest interval we ask the OS for (minutes). The OS decides the real one. */
const MIN_INTERVAL_MINUTES = 15
const ANDROID_CHANNEL = 'new-articles'
/** One notification that is replaced on every update instead of stacking up. */
const NOTIFICATION_ID = 'feedown-new-articles'
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
  settings.threshold = normalizeThreshold(settings.threshold)
  return settings
}

/** Merge and save settings, then register / unregister the OS task to match. */
export async function updateBgSettings(patch) {
  const next = { ...(await loadBgSettings()), ...patch }
  next.threshold = normalizeThreshold(next.threshold)
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

function newArticlesText(count) {
  return count === 1 ? '1 new article' : `${count} new articles`
}

async function presentNewArticles(count, foreground) {
  await ensureChannel()
  const data = { type: NEW_ARTICLES_NOTIFICATION_TYPE }
  if (foreground) data.foreground = true
  // Re-posting with the same identifier only updates a delivered notification
  // silently on iOS. Remove the old one first so the new count alerts again
  // while still leaving a single notification in the list.
  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_ID)
  } catch (e) {
    warn('failed to dismiss previous notification', e)
  }
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: {
      title: 'FeedOwn',
      body: newArticlesText(count),
      sound: 'default',
      data,
    },
    trigger: Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL } : null,
  })
}

/** Settings screen: "Send test notification". */
export async function sendTestNotification() {
  await presentNewArticles(3, true)
}

// ---- state shared with the foreground app ----------------------------------------

/**
 * `unseen`: new articles fetched in the background since the app was last
 * opened. `pending`: the part of it not yet notified (grows until the
 * threshold is reached).
 */
async function loadState() {
  const state = await loadJson(STATE_KEY, {})
  return {
    unseen: Math.max(0, Number(state?.unseen) || 0),
    pending: Math.max(0, Number(state?.pending) || 0),
  }
}

/**
 * Called when the app comes to the foreground. Clears the counters and the
 * delivered notification, and returns how many new articles the background
 * runs fetched so the caller can reload the list.
 */
export async function consumeBackgroundNewArticles() {
  const { unseen } = await loadState()
  await saveJson(STATE_KEY, { unseen: 0, pending: 0 })
  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_ID)
  } catch (e) {
    warn('failed to dismiss notification', e)
  }
  return unseen
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

let running = null

/**
 * One run. Overlapping calls share the same promise.
 *
 * @param {{foreground?: boolean}} [options] true for "Check now" on the
 *   settings screen: ignores the enabled switch and the foreground check,
 *   does not touch the background counters, and shows the notification in
 *   the foreground if the threshold is met.
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
  const canNotify =
    settings.notify && (await getNotificationPermission()) === 'granted'

  if (foreground) {
    let notified = false
    if (canNotify && newArticles > 0 && newArticles >= settings.threshold) {
      try {
        await presentNewArticles(newArticles, true)
        notified = true
      } catch (e) {
        warn('failed to post notification', e)
      }
    }
    return done({ newArticles, notified, ...(error ? { error } : {}) })
  }

  // The app was opened during the run: it shows the articles itself
  if (AppState.currentState === 'active') {
    return done({ newArticles, skipped: 'active', ...(error ? { error } : {}) })
  }

  const state = await loadState()
  state.unseen += newArticles
  // With notifications off, don't build up a backlog that would fire at once
  // when they are turned on later
  state.pending = canNotify ? state.pending + newArticles : 0
  let notified = false
  if (canNotify && state.pending > 0 && state.pending >= settings.threshold) {
    try {
      // Show the total since the app was last opened, not just this run
      await presentNewArticles(state.unseen, false)
      state.pending = 0
      notified = true
    } catch (e) {
      warn('failed to post notification', e)
    }
  }
  await saveJson(STATE_KEY, state)
  return done({ newArticles, notified, ...(error ? { error } : {}) })
}
