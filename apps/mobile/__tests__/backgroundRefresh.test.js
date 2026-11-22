/* eslint-disable global-require */
// Logic of the background refresh run: threshold accumulation, skipping while
// the app is open, clearing on return to the foreground, and the notification
// content built from the identified new articles (#27).

const mockStore = {}
const mockScheduled = []
const mockDismissed = []
let mockAppState = 'background'
let mockRefreshResponses = []
let mockPermissionGranted = true
// GET /api/articles results; null makes the call fail
let mockArticleList = null

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k) => (k in mockStore ? mockStore[k] : null)),
  setItem: jest.fn(async (k, v) => {
    mockStore[k] = v
  }),
}))

jest.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return mockAppState
    },
  },
  Platform: { OS: 'ios' },
}))

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: mockPermissionGranted, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  dismissNotificationAsync: jest.fn(async (id) => {
    mockDismissed.push(id)
  }),
  scheduleNotificationAsync: jest.fn(async (req) => {
    mockScheduled.push(req)
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
      refreshAll: jest.fn(async () => mockRefreshResponses.shift() || { success: true, data: { stats: { newArticles: 0 } } }),
    },
    articles: {
      list: jest.fn(async () =>
        mockArticleList
          ? { success: true, data: { articles: mockArticleList } }
          : { success: false, error: 'HTTP 500' }),
    },
  }),
}))

const bg = require('../src/utils/backgroundRefresh')

const batch = (newArticles, extra = {}) => ({
  success: true,
  data: { stats: { newArticles }, remaining: 0, ...extra },
})

beforeEach(() => {
  Object.keys(mockStore).forEach((k) => delete mockStore[k])
  mockScheduled.length = 0
  mockDismissed.length = 0
  mockAppState = 'background'
  mockRefreshResponses = []
  mockPermissionGranted = true
  mockArticleList = null
})

test('does nothing while disabled', async () => {
  const result = await bg.runBackgroundRefresh()
  expect(result.skipped).toBe('off')
  expect(mockScheduled).toHaveLength(0)
})

test('skips while the app is in the foreground', async () => {
  await bg.updateBgSettings({ enabled: true, notify: true })
  mockAppState = 'active'
  const result = await bg.runBackgroundRefresh()
  expect(result.skipped).toBe('active')
})

test('accumulates until the threshold, then notifies the total since last open', async () => {
  await bg.updateBgSettings({ enabled: true, notify: true, threshold: 5 })

  mockRefreshResponses = [batch(3)]
  let result = await bg.runBackgroundRefresh()
  expect(result).toMatchObject({ newArticles: 3, notified: false })
  expect(mockScheduled).toHaveLength(0)

  mockRefreshResponses = [batch(2)]
  result = await bg.runBackgroundRefresh()
  expect(result).toMatchObject({ newArticles: 2, notified: true })
  expect(mockScheduled).toHaveLength(1)
  expect(mockScheduled[0].content.body).toBe('5 new articles')

  // Counting restarts for the next alert, but the body keeps the running total
  mockRefreshResponses = [batch(4)]
  result = await bg.runBackgroundRefresh()
  expect(result.notified).toBe(false)
  mockRefreshResponses = [batch(1)]
  result = await bg.runBackgroundRefresh()
  expect(result.notified).toBe(true)
  expect(mockScheduled[1].content.body).toBe('10 new articles')
  // The previous notification is removed so the update alerts again
  expect(mockDismissed).toContain('feedown-new-articles')
})

test('calls refresh once per run (the server allows 1 per 30 s)', async () => {
  await bg.updateBgSettings({ enabled: true, notify: true, threshold: 1 })
  mockRefreshResponses = [
    batch(1, { remaining: 5, nextOffset: 5 }),
    batch(2, { remaining: 0 }),
  ]
  const result = await bg.runBackgroundRefresh()
  expect(result).toMatchObject({ newArticles: 1, notified: true })
  expect(mockRefreshResponses).toHaveLength(1)
})

test('treats the server rate limit as a skip, not an error', async () => {
  await bg.updateBgSettings({ enabled: true, notify: true, threshold: 1 })
  mockRefreshResponses = [{ success: false, status: 429, error: 'Too many refresh requests.' }]
  const result = await bg.runBackgroundRefresh()
  expect(result.skipped).toBe('rate-limited')
  expect(result.error).toBeUndefined()
  expect(mockScheduled).toHaveLength(0)
})

test('fetches without notifying when notifications are off, and builds no backlog', async () => {
  await bg.updateBgSettings({ enabled: true, notify: false, threshold: 1 })
  mockRefreshResponses = [batch(7)]
  const result = await bg.runBackgroundRefresh()
  expect(result).toMatchObject({ newArticles: 7, notified: false })
  expect(mockScheduled).toHaveLength(0)

  // Turning notifications on later does not fire for the old articles
  await bg.updateBgSettings({ notify: true })
  mockRefreshResponses = [batch(0)]
  expect((await bg.runBackgroundRefresh()).notified).toBe(false)
  // ...but the app still reloads the list for them on return
  expect(await bg.consumeBackgroundNewArticles()).toBe(7)
})

test('opening the app clears the counters', async () => {
  await bg.updateBgSettings({ enabled: true, notify: true, threshold: 5 })
  mockRefreshResponses = [batch(4)]
  await bg.runBackgroundRefresh()
  expect(await bg.consumeBackgroundNewArticles()).toBe(4)
  expect(await bg.consumeBackgroundNewArticles()).toBe(0)

  // The 4 seen articles do not count toward the next alert
  mockRefreshResponses = [batch(1)]
  expect((await bg.runBackgroundRefresh()).notified).toBe(false)
})

test('tells the running app when it was opened mid-run', async () => {
  await bg.updateBgSettings({ enabled: true, notify: true, threshold: 1 })
  const got = []
  const unsubscribe = bg.onBackgroundArticles((n) => got.push(n))
  const api = require('../src/utils/api')
  // Become active while the refresh request is in flight
  mockRefreshResponses = []
  const original = api.createApiClient
  api.createApiClient = () => ({
    refresh: {
      refreshAll: async () => {
        mockAppState = 'active'
        return batch(2)
      },
    },
  })
  const result = await bg.runBackgroundRefresh()
  api.createApiClient = original
  unsubscribe()
  expect(result.skipped).toBe('active')
  expect(got).toEqual([2])
  expect(mockScheduled).toHaveLength(0)
})

test('does not notify without permission', async () => {
  await bg.updateBgSettings({ enabled: true, notify: true, threshold: 1 })
  mockPermissionGranted = false
  mockRefreshResponses = [batch(3)]
  const result = await bg.runBackgroundRefresh()
  expect(result.notified).toBe(false)
  expect(mockScheduled).toHaveLength(0)
})

test('records refresh errors in the run log', async () => {
  await bg.updateBgSettings({ enabled: true })
  mockRefreshResponses = [{ success: false, error: 'HTTP 500' }]
  const result = await bg.runBackgroundRefresh()
  expect(result.error).toBe('HTTP 500')
  const log = await bg.loadRunLog()
  expect(log[0]).toMatchObject({ background: true, error: 'HTTP 500' })
})

test('Check Now ignores the switch and leaves background counters alone', async () => {
  await bg.updateBgSettings({ enabled: false, notify: true, threshold: 1 })
  mockAppState = 'active'
  mockRefreshResponses = [batch(2)]
  const result = await bg.runBackgroundRefresh({ foreground: true })
  expect(result).toMatchObject({ newArticles: 2, notified: true })
  expect(mockScheduled[0].content.data.foreground).toBe(true)
  expect(await bg.consumeBackgroundNewArticles()).toBe(0)
})

// ---- #27: notification content from the identified articles --------------------

const NOW_ISO = () => new Date().toISOString()
const OLD_ISO = '2020-01-01T00:00:00Z'
const article = (id, feedId, feedTitle, title, fetchedAt = NOW_ISO()) => ({
  id, feedId, feedTitle, title, url: `https://example.com/${id}`, fetchedAt,
  publishedAt: fetchedAt, description: 'x'.repeat(2000),
})

test('27a: lists per-feed counts and the latest titles', async () => {
  await bg.updateBgSettings({ enabled: true, notify: true, threshold: 1 })
  mockArticleList = [
    article('a1', 'tc', 'TechCrunch', 'TC one'),
    article('a2', 'hn', 'Hacker News', 'HN one'),
    article('a3', 'tc', 'TechCrunch', 'TC two'),
    article('old', 'tc', 'TechCrunch', 'Seen before', OLD_ISO),
  ]
  mockRefreshResponses = [batch(4)]
  const result = await bg.runBackgroundRefresh()
  expect(result).toMatchObject({ newArticles: 4, identified: 3, notified: true })
  const { title, body, data } = mockScheduled[0].content
  expect(title).toBe('FeedOwn — 4 new articles')
  // The 4th article was not identified and shows up as "+1 more"
  expect(body).toBe('TechCrunch 2 · Hacker News 1 · +1 more\n• TC one\n• HN one')
  expect(data.article).toBeUndefined()
})

test('27a: falls back to the count when the list cannot be read', async () => {
  await bg.updateBgSettings({ enabled: true, notify: true, threshold: 1 })
  mockRefreshResponses = [batch(2)]
  const result = await bg.runBackgroundRefresh()
  expect(result).toMatchObject({ notified: true, listError: 'HTTP 500' })
  expect(mockScheduled[0].content).toMatchObject({ title: 'FeedOwn', body: '2 new articles' })
})

test('27b: a single new article is shown and carries the article', async () => {
  await bg.updateBgSettings({ enabled: true, notify: true, threshold: 1 })
  mockArticleList = [article('a1', 'tc', 'TechCrunch', 'Only one')]
  mockRefreshResponses = [batch(1)]
  await bg.runBackgroundRefresh()
  const { title, body, data } = mockScheduled[0].content
  expect(title).toBe('TechCrunch')
  expect(body).toBe('Only one')
  expect(data.article).toMatchObject({ id: 'a1', url: 'https://example.com/a1' })
  // Kept small for the notification payload
  expect(data.article.description.length).toBeLessThanOrEqual(500)
})

test('27a: the summary accumulates across runs until the app is opened', async () => {
  await bg.updateBgSettings({ enabled: true, notify: true, threshold: 1 })
  mockArticleList = [article('a1', 'tc', 'TechCrunch', 'First')]
  mockRefreshResponses = [batch(1)]
  await bg.runBackgroundRefresh()
  mockArticleList = [article('a2', 'hn', 'Hacker News', 'Second'), article('a1', 'tc', 'TechCrunch', 'First', OLD_ISO)]
  mockRefreshResponses = [batch(1)]
  await bg.runBackgroundRefresh()
  expect(mockScheduled[1].content.title).toBe('FeedOwn — 2 new articles')
  expect(mockScheduled[1].content.body).toBe('TechCrunch 1 · Hacker News 1\n• Second\n• First')

  await bg.consumeBackgroundNewArticles()
  mockArticleList = [article('a3', 'hn', 'Hacker News', 'Third')]
  mockRefreshResponses = [batch(1)]
  await bg.runBackgroundRefresh()
  expect(mockScheduled[2].content).toMatchObject({ title: 'Hacker News', body: 'Third' })
})

test('27c: muted feeds count for reload but not for the notification', async () => {
  await bg.updateBgSettings({ enabled: true, notify: true, threshold: 2, mutedFeedIds: ['tc'] })
  mockArticleList = [
    article('a1', 'tc', 'TechCrunch', 'Muted one'),
    article('a2', 'tc', 'TechCrunch', 'Muted two'),
    article('a3', 'hn', 'Hacker News', 'Visible'),
  ]
  mockRefreshResponses = [batch(3)]
  const result = await bg.runBackgroundRefresh()
  // Only 1 notifiable article, below the threshold of 2
  expect(result).toMatchObject({ newArticles: 3, muted: 2, notified: false })
  expect(mockScheduled).toHaveLength(0)
  expect(await bg.consumeBackgroundNewArticles()).toBe(3)
})

test('27d: keyword matches notify right away, ignoring the threshold', async () => {
  await bg.updateBgSettings({ enabled: true, notify: true, threshold: 50, keywords: ['ｒｅａｃｔ ｎａｔｉｖｅ'] })
  mockArticleList = [
    article('a1', 'tc', 'TechCrunch', 'What is new in React Native 0.88'),
    article('a2', 'tc', 'TechCrunch', 'Unrelated'),
  ]
  mockRefreshResponses = [batch(2)]
  const result = await bg.runBackgroundRefresh()
  expect(result).toMatchObject({ notified: false, keywordNotified: true, keywordMatches: 1 })
  expect(mockScheduled).toHaveLength(1)
  expect(mockScheduled[0].identifier).toBe('feedown-keyword')
  expect(mockScheduled[0].content.body).toBe('What is new in React Native 0.88')
  expect(mockScheduled[0].content.data.article.id).toBe('a1')
})

test('27d: muted feeds never notify, even on a keyword match', async () => {
  await bg.updateBgSettings({ enabled: true, notify: true, threshold: 50, keywords: ['rust'], mutedFeedIds: ['tc'] })
  mockArticleList = [article('a1', 'tc', 'TechCrunch', 'Rust 2.0 released')]
  mockRefreshResponses = [batch(1)]
  const result = await bg.runBackgroundRefresh()
  expect(result.keywordNotified).toBeUndefined()
  expect(mockScheduled).toHaveLength(0)
})

test('27d: keywords are trimmed and de-duplicated in settings', async () => {
  const s = await bg.updateBgSettings({ keywords: [' Rust ', 'rust', 'ＲＵＳＴ', '', 'Go'] })
  expect(s.keywords).toEqual(['Rust', 'Go'])
})

test('Check Now builds the content from this run only', async () => {
  await bg.updateBgSettings({ enabled: true, notify: true, threshold: 1 })
  mockArticleList = [article('a1', 'tc', 'TechCrunch', 'Fresh'), article('a2', 'tc', 'TechCrunch', 'Fresh 2')]
  mockRefreshResponses = [batch(2)]
  const result = await bg.runBackgroundRefresh({ foreground: true })
  expect(result).toMatchObject({ notified: true, identified: 2 })
  expect(mockScheduled[0].content.title).toBe('FeedOwn — 2 new articles')
  expect(mockScheduled[0].content.data.foreground).toBe(true)
})

test('isDelivering needs the task, the switch and the OS permission', () => {
  const on = { enabled: true, notify: true }
  expect(bg.isDelivering(on, 'granted')).toBe(true)
  expect(bg.isDelivering(on, 'denied')).toBe(false)
  expect(bg.isDelivering({ ...on, enabled: false }, 'granted')).toBe(false)
  expect(bg.isDelivering({ ...on, notify: false }, 'granted')).toBe(false)
})
