/**
 * Feeds that keep failing to refresh (BRUSHUP #4). The server counts
 * consecutive failures in `errorCount` and resets it on success
 * (functions/api/refresh.ts). The web app uses the same threshold
 * (apps/web/src/pages/FeedsPage.jsx).
 */

/** Consecutive failed refreshes after which a feed is shown as not updating. */
export const FEED_ERROR_THRESHOLD = 3

const DAY_MS = 24 * 60 * 60 * 1000

export function isFeedFailing(feed) {
  return (Number(feed?.errorCount) || 0) >= FEED_ERROR_THRESHOLD
}

export function describeLastSuccess(lastSuccessAt, now = Date.now()) {
  const time = lastSuccessAt ? Date.parse(lastSuccessAt) : NaN
  if (Number.isNaN(time)) return 'Never fetched successfully'
  const days = Math.floor((now - time) / DAY_MS)
  if (days <= 0) return 'Last success: today'
  if (days === 1) return 'Last success: 1 day ago'
  return `Last success: ${days} days ago`
}
