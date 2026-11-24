import { keywordRanges, matchKeyword } from '../src/utils/newArticleNotifications'

const mark = (text, ranges) => ranges.map(([s, e]) => text.slice(s, e))

test('keywordRanges finds each occurrence in the original text', () => {
  const title = 'iPhone18eの背面カメラ、iPhone18とAir 2'
  expect(mark(title, keywordRanges(title, 'iphone18'))).toEqual(['iPhone18', 'iPhone18'])
})

test('keywordRanges matches like matchKeyword: NFKC and case-insensitive', () => {
  const title = 'ＩＰＨＯＮＥ18Ｅ leak'
  expect(matchKeyword(title, ['iphone18e'])).toBe('iphone18e')
  expect(mark(title, keywordRanges(title, 'iphone18e'))).toEqual(['ＩＰＨＯＮＥ18Ｅ'])
  const half = 'ｶﾒﾗの話'
  expect(mark(half, keywordRanges(half, 'カメラ'))).toEqual(['ｶﾒﾗ'])
})

test('keywordRanges keeps surrogate pairs and expanding characters whole', () => {
  const title = '😀 AI ㍉ news'
  expect(mark(title, keywordRanges(title, 'ai'))).toEqual(['AI'])
  // ㍉ normalizes to ミリ: the whole character is marked
  expect(mark(title, keywordRanges(title, 'ミリ'))).toEqual(['㍉'])
})

test('keywordRanges returns nothing for no match or an empty keyword', () => {
  expect(keywordRanges('Hello', 'bye')).toEqual([])
  expect(keywordRanges('Hello', '  ')).toEqual([])
  expect(keywordRanges('', 'a')).toEqual([])
})
