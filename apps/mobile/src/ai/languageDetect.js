export function detectLanguage(text) {
  if (!text || text.length < 20) return 'en'

  const sample = text.slice(0, 600)
  let cjk = 0, hangul = 0, hiragana = 0, katakana = 0, total = 0

  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i)
    if (c > 0x20) total++
    if (c >= 0x4E00 && c <= 0x9FFF) cjk++
    if (c >= 0xAC00 && c <= 0xD7A3) hangul++
    if (c >= 0x3040 && c <= 0x309F) hiragana++
    if (c >= 0x30A0 && c <= 0x30FF) katakana++
  }

  if (total === 0) return 'en'
  if ((hiragana + katakana) / total > 0.03) return 'ja'
  if (hangul / total > 0.05) return 'ko'
  if (cjk / total > 0.15) return 'zh'
  return 'en'
}
