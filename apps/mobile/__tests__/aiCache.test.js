/* eslint-disable global-require */
// 7-day TTL of the AI result cache (BRUSHUP #14)

const mockStore = {}

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k) => (k in mockStore ? mockStore[k] : null)),
  setItem: jest.fn(async (k, v) => {
    mockStore[k] = v
  }),
  removeItem: jest.fn(async (k) => {
    delete mockStore[k]
  }),
  getAllKeys: jest.fn(async () => Object.keys(mockStore)),
  multiGet: jest.fn(async (keys) => keys.map((k) => [k, mockStore[k] ?? null])),
  multiRemove: jest.fn(async (keys) => {
    keys.forEach((k) => delete mockStore[k])
  }),
}))
jest.mock('../src/ai/models', () => ({ MODEL_DEFINITION_VERSION: 7 }))
jest.mock('../src/ai/jsonOutput', () => ({ normalizeSignalsShape: (r) => r }))

const cache = require('../src/ai/aiCache')

const DAY = 24 * 60 * 60 * 1000
const SUMMARY = 'feedown:ai:summary:'
const TRANSLATION = 'feedown:ai:translation:'

function record(ageMs, extra = {}) {
  return JSON.stringify({
    modelDefinitionVersion: 7,
    createdAt: new Date(Date.now() - ageMs).toISOString(),
    result: 'r',
    ...extra,
  })
}

beforeEach(() => {
  Object.keys(mockStore).forEach((k) => delete mockStore[k])
})

test('isExpired: older than 7 days, or no readable createdAt', () => {
  const now = Date.now()
  expect(cache.isExpired({ createdAt: new Date(now - 6 * DAY).toISOString() }, now)).toBe(false)
  expect(cache.isExpired({ createdAt: new Date(now - 8 * DAY).toISOString() }, now)).toBe(true)
  expect(cache.isExpired({}, now)).toBe(true)
  expect(cache.isExpired({ createdAt: 'garbage' }, now)).toBe(true)
})

test('a fresh record is returned; an expired one is null and deleted', async () => {
  await cache.saveTranslationCache('a1', 'h', 'm', 'ja', 'fresh')
  expect(await cache.getTranslationCache('a1', 'h', 'm', 'ja')).toBe('fresh')

  const key = `${TRANSLATION}a1:h:m:en`
  mockStore[key] = record(8 * DAY, { readerHash: 'h' })
  expect(await cache.getTranslationCache('a1', 'h', 'm', 'en')).toBeNull()
  expect(mockStore[key]).toBeUndefined()

  const summaryKey = `${SUMMARY}a2:c:m:neutral:ja`
  mockStore[summaryKey] = record(8 * DAY, { contentHash: 'c' })
  expect(await cache.getSummaryCache('a2', 'c', 'm', 'neutral', 'ja')).toBeNull()
  expect(mockStore[summaryKey]).toBeUndefined()
})

test('sweep removes expired and unreadable records only', async () => {
  mockStore[`${SUMMARY}old`] = record(8 * DAY)
  mockStore[`${SUMMARY}new`] = record(1 * DAY)
  mockStore[`${TRANSLATION}old`] = record(30 * DAY)
  mockStore[`${TRANSLATION}broken`] = '{not json'
  mockStore['feedown:ai:settings'] = JSON.stringify({ enabled: true })
  mockStore['@feedown_user'] = '{}'

  expect(await cache.sweepExpiredAiCache()).toBe(3)
  expect(Object.keys(mockStore).sort()).toEqual(
    ['@feedown_user', 'feedown:ai:settings', `${SUMMARY}new`].sort()
  )
})

test('sweep never throws', async () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage')
  AsyncStorage.getAllKeys.mockImplementationOnce(async () => {
    throw new Error('boom')
  })
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  expect(await cache.sweepExpiredAiCache()).toBe(0)
  warn.mockRestore()
})
