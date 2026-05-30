// Reasoning models (Qwen3 family, some Llama 3 variants) emit
// <think>...</think> blocks before the visible answer. They leak into:
//   - chat replies (user sees the reasoning)
//   - summary / signals JSON (parser may still recover via extractJson
//     since the JSON is after </think>, but a stray { inside the think
//     block can fool the extractor)
// Strip them defensively at every visible / parsed boundary.
export function stripThinkTags(text) {
  if (!text) return text
  let result = text.replace(/<think>[\s\S]*?<\/think>/gi, '')
  // Handle unclosed tags (generation cut off mid-think): drop everything
  // from the opening <think> to the end.
  result = result.replace(/<think>[\s\S]*$/i, '')
  return result.trim()
}

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
  const jsonStr = extractJson(stripThinkTags(rawText))
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
  const jsonStr = extractJsonArray(stripThinkTags(rawText))
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
  const jsonStr = extractJson(stripThinkTags(rawText))
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
