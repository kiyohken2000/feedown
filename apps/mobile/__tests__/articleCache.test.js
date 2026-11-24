/* eslint-disable global-require */
// Offline copy of the home list (BRUSHUP #8)

const mockStore = {}
let mockUser = { uid: 'u1', email: 'a@example.com' }
let mockServerUrl = 'https://feedown.example'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k) => (k in mockStore ? mockStore[k] : null)),
  setItem: jest.fn(async (k, v) => {
    mockStore[k] = v
  }),
  removeItem: jest.fn(async (k) => {
    delete mockStore[k]
  }),
}))
jest.mock('../src/utils/supabase', () => ({
  getServerUrl: jest.fn(async () => mockServerUrl),
  getUser: jest.fn(async () => mockUser),
}))

const cache = require('../src/utils/articleCache')

const article = (id, publishedAt, extra = {}) => ({
  id,
  title: `t-${id}`,
  publishedAt,
  isRead: false,
  ...extra,
})

beforeEach(() => {
  Object.keys(mockStore).forEach((k) => delete mockStore[k])
  mockUser = { uid: 'u1', email: 'a@example.com' }
  mockServerUrl = 'https://feedown.example'
})

test('saves and loads the list with its read state and sync time', async () => {
  expect(await cache.loadArticleCache()).toBeNull()
  const list = [article('a', '2026-11-24T10:00:00Z', { isRead: true }), article('b', '2026-11-24T09:00:00Z')]
  expect(await cache.saveArticleCache(list, 12345)).toBe(true)
  const loaded = await cache.loadArticleCache()
  expect(loaded.articles).toEqual(list)
  expect(loaded.syncedAt).toBe(12345)
})

test('keeps at most 100 articles and cuts long descriptions', async () => {
  const list = Array.from({ length: 130 }, (_, i) =>
    article(`a${i}`, null, { description: 'x'.repeat(5000) }))
  await cache.saveArticleCache(list, 1)
  const { articles } = await cache.loadArticleCache()
  expect(articles).toHaveLength(100)
  expect(articles[0].description).toHaveLength(2000)
})

test('another account or server never sees the cache', async () => {
  await cache.saveArticleCache([article('a', null)], 1)
  mockUser = { uid: 'u2' }
  expect(await cache.loadArticleCache()).toBeNull()
  mockUser = { uid: 'u1' }
  mockServerUrl = 'https://other.example'
  expect(await cache.loadArticleCache()).toBeNull()
  mockServerUrl = 'https://feedown.example'
  expect(await cache.loadArticleCache()).not.toBeNull()
})

test('does not save while signed out', async () => {
  mockUser = null
  expect(await cache.saveArticleCache([article('a', null)], 1)).toBe(false)
  expect(Object.keys(mockStore)).toHaveLength(0)
})

test('mergeArticles replaces by id, adds the rest, sorts newest first', () => {
  const { articles, added } = cache.mergeArticles(
    [article('a', '2026-11-20T00:00:00Z', { isRead: true }), article('b', '2026-11-22T00:00:00Z')],
    [article('a', '2026-11-20T00:00:00Z', { title: 'updated' }), article('c', '2026-11-23T00:00:00Z')]
  )
  expect(articles.map((a) => a.id)).toEqual(['c', 'b', 'a'])
  expect(articles[2]).toMatchObject({ title: 'updated', isRead: false })
  expect(added).toBe(1)
  expect(cache.mergeArticles([], [article('a', null), article('b', null)], 1).articles).toHaveLength(1)
})

test('prefetch merges into an existing cache of the same account only', async () => {
  // No cache yet: an unread-only list must not become the cache
  expect(await cache.mergeIntoArticleCache([article('n', '2026-11-24T11:00:00Z')])).toBe(0)
  expect(await cache.loadArticleCache()).toBeNull()

  await cache.saveArticleCache([article('a', '2026-11-24T10:00:00Z', { isRead: true })], 1)
  expect(await cache.mergeIntoArticleCache([article('n', '2026-11-24T11:00:00Z')])).toBe(1)
  const loaded = await cache.loadArticleCache()
  expect(loaded.articles.map((a) => a.id)).toEqual(['n', 'a'])
  expect(loaded.articles[1].isRead).toBe(true)
  expect(loaded.syncedAt).toBeGreaterThan(1)

  mockUser = { uid: 'u2' }
  expect(await cache.mergeIntoArticleCache([article('z', null)])).toBe(0)
})

test('clear removes it', async () => {
  await cache.saveArticleCache([article('a', null)], 1)
  await cache.clearArticleCache()
  expect(await cache.loadArticleCache()).toBeNull()
})
