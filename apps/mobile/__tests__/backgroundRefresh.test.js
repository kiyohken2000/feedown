/* eslint-disable global-require */
// Logic of the background refresh run: threshold accumulation, skipping while
// the app is open, and clearing on return to the foreground.

const store = {}
const scheduled = []
const dismissed = []
let appState = 'background'
let refreshResponses = []
let permissionGranted = true

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k) => (k in store ? store[k] : null)),
  setItem: jest.fn(async (k, v) => {
    store[k] = v
  }),
}))

jest.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return appState
    },
  },
  Platform: { OS: 'ios' },
}))

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: permissionGranted, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  dismissNotificationAsync: jest.fn(async (id) => {
    dismissed.push(id)
  }),
  scheduleNotificationAsync: jest.fn(async (req) => {
    scheduled.push(req)
  }),
  AndroidImportance: { DEFAULT: 3 },
}))

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(async () => false),
}))

jest.mock('expo-background-task', () => ({
  registerTaskAsync: jest.fn(),
  unregisterTaskAsync: jest.fn(),
  getStatusAsync: jest.fn(),
  BackgroundTaskResult: { Success: 1, Failed: 2 },
  BackgroundTaskStatus: { Restricted: 1, Available: 2 },
}))

jest.mock('../src/utils/supabase', () => ({
  getAuthToken: jest.fn(async () => 'token'),
}))

jest.mock('../src/utils/api', () => ({
  createApiClient: () => ({
    refresh: {
      refreshAll: jest.fn(async () => refreshResponses.shift() || { success: true, data: { stats: { newArticles: 0 } } }),
    },
  }),
}))

const bg = require('../src/utils/backgroundRefresh')

const batch = (newArticles, extra = {}) => ({
  success: true,
  data: { stats: { newArticles }, remaining: 0, ...extra },
})

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k])
  scheduled.length = 0
  dismissed.length = 0
  appState = 'background'
  refreshResponses = []
  permissionGranted = true
})

test('does nothing while disabled', async () => {
  const result = await bg.runBackgroundRefresh()
  expect(result.skipped).toBe('off')
  expect(scheduled).toHaveLength(0)
})

test('skips while the app is in the foreground', async () => {
  await bg.updateBgSettings({ enabled: true, notify: true })
  appState = 'active'
  const result = await bg.runBackgroundRefresh()
  expect(result.skipped).toBe('active')
})

test('accumulates until the threshold, then notifies the total since last open', async () => {
  await bg.updateBgSettings({ enabled: true, notify: true, threshold: 5 })

  refreshResponses = [batch(3)]
  let result = await bg.runBackgroundRefresh()
  expect(result).toMatchObject({ newArticles: 3, notified: false })
  expect(scheduled).toHaveLength(0)

  refreshResponses = [batch(2)]
  result = await bg.runBackgroundRefresh()
  expect(result).toMatchObject({ newArticles: 2, notified: true })
  expect(scheduled).toHaveLength(1)
  expect(scheduled[0].content.body).toBe('5 new articles')

  // Counting restarts for the next alert, but the body keeps the running total
  refreshResponses = [batch(4)]
  result = await bg.runBackgroundRefresh()
  expect(result.notified).toBe(false)
  refreshResponses = [batch(1)]
  result = await bg.runBackgroundRefresh()
  expect(result.notified).toBe(true)
  expect(scheduled[1].content.body).toBe('10 new articles')
  // The previous notification is removed so the update alerts again
  expect(dismissed).toContain('feedown-new-articles')
})

test('calls refresh once per run (the server allows 1 per 30 s)', async () => {
  await bg.updateBgSettings({ enabled: true, notify: true, threshold: 1 })
  refreshResponses = [
    batch(1, { remaining: 5, nextOffset: 5 }),
    batch(2, { remaining: 0 }),
  ]
  const result = await bg.runBackgroundRefresh()
  expect(result).toMatchObject({ newArticles: 1, notified: true })
  expect(refreshResponses).toHaveLength(1)
})

test('treats the server rate limit as a skip, not an error', async () => {
  await bg.updateBgSettings({ enabled: true, notify: true, threshold: 1 })
  refreshResponses = [{ success: false, status: 429, error: 'Too many refresh requests.' }]
  const result = await bg.runBackgroundRefresh()
  expect(result.skipped).toBe('rate-limited')
  expect(result.error).toBeUndefined()
  expect(scheduled).toHaveLength(0)
})

test('fetches without notifying when notifications are off, and builds no backlog', async () => {
  await bg.updateBgSettings({ enabled: true, notify: false, threshold: 1 })
  refreshResponses = [batch(7)]
  const result = await bg.runBackgroundRefresh()
  expect(result).toMatchObject({ newArticles: 7, notified: false })
  expect(scheduled).toHaveLength(0)

  // Turning notifications on later does not fire for the old articles
  await bg.updateBgSettings({ notify: true })
  refreshResponses = [batch(0)]
  expect((await bg.runBackgroundRefresh()).notified).toBe(false)
  // ...but the app still reloads the list for them on return
  expect(await bg.consumeBackgroundNewArticles()).toBe(7)
})

test('opening the app clears the counters', async () => {
  await bg.updateBgSettings({ enabled: true, notify: true, threshold: 5 })
  refreshResponses = [batch(4)]
  await bg.runBackgroundRefresh()
  expect(await bg.consumeBackgroundNewArticles()).toBe(4)
  expect(await bg.consumeBackgroundNewArticles()).toBe(0)

  // The 4 seen articles do not count toward the next alert
  refreshResponses = [batch(1)]
  expect((await bg.runBackgroundRefresh()).notified).toBe(false)
})

test('tells the running app when it was opened mid-run', async () => {
  await bg.updateBgSettings({ enabled: true, notify: true, threshold: 1 })
  const got = []
  const unsubscribe = bg.onBackgroundArticles((n) => got.push(n))
  const api = require('../src/utils/api')
  // Become active while the refresh request is in flight
  refreshResponses = []
  const original = api.createApiClient
  api.createApiClient = () => ({
    refresh: {
      refreshAll: async () => {
        appState = 'active'
        return batch(2)
      },
    },
  })
  const result = await bg.runBackgroundRefresh()
  api.createApiClient = original
  unsubscribe()
  expect(result.skipped).toBe('active')
  expect(got).toEqual([2])
  expect(scheduled).toHaveLength(0)
})

test('does not notify without permission', async () => {
  await bg.updateBgSettings({ enabled: true, notify: true, threshold: 1 })
  permissionGranted = false
  refreshResponses = [batch(3)]
  const result = await bg.runBackgroundRefresh()
  expect(result.notified).toBe(false)
  expect(scheduled).toHaveLength(0)
})

test('records refresh errors in the run log', async () => {
  await bg.updateBgSettings({ enabled: true })
  refreshResponses = [{ success: false, error: 'HTTP 500' }]
  const result = await bg.runBackgroundRefresh()
  expect(result.error).toBe('HTTP 500')
  const log = await bg.loadRunLog()
  expect(log[0]).toMatchObject({ background: true, error: 'HTTP 500' })
})

test('Check Now ignores the switch and leaves background counters alone', async () => {
  await bg.updateBgSettings({ enabled: false, notify: true, threshold: 1 })
  appState = 'active'
  refreshResponses = [batch(2)]
  const result = await bg.runBackgroundRefresh({ foreground: true })
  expect(result).toMatchObject({ newArticles: 2, notified: true })
  expect(scheduled[0].content.data.foreground).toBe(true)
  expect(await bg.consumeBackgroundNewArticles()).toBe(0)
})
