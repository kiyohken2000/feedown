function extractJsonArray(rawText) {
  if (!rawText) return ''
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  const start = rawText.indexOf('[')
  const end = rawText.lastIndexOf(']')
  if (start !== -1 && end !== -1 && end > start) {
    return rawText.slice(start, end + 1)
  }
  return rawText.trim()
}

export function extractJson(rawText) {
  if (!rawText) return ''
  // ```json ... ``` または ``` ... ``` ブロックを除去
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  // JSON オブジェクトの開始位置を探す
  const start = rawText.indexOf('{')
  const end = rawText.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return rawText.slice(start, end + 1)
  }
  return rawText.trim()
}

const VALID_SIGNAL_TYPES = ['fact', 'claim', 'speculation', 'quote', 'promotion', 'unclear']
const VALID_CONFIDENCES = ['high', 'medium', 'low']

export function parseSummaryOutput(rawText) {
  const jsonStr = extractJson(rawText)
  let parsed
  try {
    parsed = JSON.parse(jsonStr)
  } catch (e) {
    return { ok: false, error: `JSON parse error: ${e.message}`, raw: rawText }
  }
  if (!parsed || !Array.isArray(parsed.summary) || parsed.summary.length === 0) {
    return { ok: false, error: 'Missing or empty summary array', raw: rawText }
  }
  const data = {
    summary: parsed.summary.filter((s) => typeof s === 'string' && s.trim()),
    caveats: Array.isArray(parsed.caveats)
      ? parsed.caveats.filter((c) => typeof c === 'string' && c.trim())
      : [],
  }
  if (data.summary.length === 0) {
    return { ok: false, error: 'No valid summary items', raw: rawText }
  }
  return { ok: true, data }
}

export function parseTranslationOutput(rawText) {
  const jsonStr = extractJsonArray(rawText)
  let parsed
  try {
    parsed = JSON.parse(jsonStr)
  } catch (e) {
    return { ok: false, error: `JSON parse error: ${e.message}`, raw: rawText }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { ok: false, error: 'Expected non-empty JSON array', raw: rawText }
  }
  const data = parsed.map((s) => (typeof s === 'string' ? s.trim() : String(s))).filter(Boolean)
  if (data.length === 0) {
    return { ok: false, error: 'No valid translation items', raw: rawText }
  }
  return { ok: true, data }
}

export function buildTranslationRepairMessages(originalMessages, brokenRaw) {
  return [
    ...originalMessages,
    { role: 'assistant', content: brokenRaw },
    {
      role: 'user',
      content:
        'Your previous response was not a valid JSON array. Output only ["translated 1", "translated 2", ...] with no explanation or code block.',
    },
  ]
}

export function parseSignalsOutput(rawText) {
  const jsonStr = extractJson(rawText)
  let parsed
  try {
    parsed = JSON.parse(jsonStr)
  } catch (e) {
    return { ok: false, error: `JSON parse error: ${e.message}`, raw: rawText }
  }
  if (!parsed || !Array.isArray(parsed.signals)) {
    return { ok: false, error: 'Missing signals array', raw: rawText }
  }
  const signals = parsed.signals.filter(
    (s) =>
      s &&
      VALID_SIGNAL_TYPES.includes(s.type) &&
      typeof s.text === 'string' &&
      s.text.trim() &&
      VALID_CONFIDENCES.includes(s.confidence),
  )
  return {
    ok: true,
    data: {
      signals,
      insufficient: parsed.insufficient === true,
    },
  }
}
