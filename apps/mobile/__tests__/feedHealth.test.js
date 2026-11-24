import { describeLastSuccess, isFeedFailing } from '../src/utils/feedHealth'

const DAY = 24 * 60 * 60 * 1000

test('flags feeds from the third failure in a row', () => {
  expect(isFeedFailing({ errorCount: 2 })).toBe(false)
  expect(isFeedFailing({ errorCount: 3 })).toBe(true)
  expect(isFeedFailing({})).toBe(false)
  expect(isFeedFailing(null)).toBe(false)
})

test('describes the last successful fetch', () => {
  const now = Date.parse('2026-11-24T12:00:00Z')
  expect(describeLastSuccess(null, now)).toBe('Never fetched successfully')
  expect(describeLastSuccess('not a date', now)).toBe('Never fetched successfully')
  expect(describeLastSuccess(new Date(now - 2 * 3600 * 1000).toISOString(), now)).toBe('Last success: today')
  expect(describeLastSuccess(new Date(now - DAY - 1000).toISOString(), now)).toBe('Last success: 1 day ago')
  expect(describeLastSuccess(new Date(now - 9 * DAY).toISOString(), now)).toBe('Last success: 9 days ago')
})
