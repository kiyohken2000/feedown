import { jsonrepair } from 'jsonrepair'

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

// Resilient JSON parser. Small LLMs frequently emit JSON with trailing
// commas, unclosed brackets (truncation), smart quotes, single quotes, or
// preamble text. We try escalating recovery before giving up so the user
// doesn't hit a "Failed to generate" toast just because the closing `}`
// got eaten by sampling noise.
function tryParseStructured(stripped, extracted) {
  // 1. Fast path: well-formed JSON.
  try {
    return JSON.parse(extracted)
  } catch (_) {
    // Fall through.
  }
  // 2. jsonrepair on the extracted substring — fixes trailing commas,
  //    unclosed brackets, single/smart quotes, comments, etc.
  try {
    return JSON.parse(jsonrepair(extracted))
  } catch (_) {
    // Fall through.
  }
  // 3. jsonrepair on the full stripped text — useful when extractJson's
  //    "first { ... last }" heuristic grabbed something wrong (e.g. a `{`
  //    inside a string before the actual JSON object).
  try {
    return JSON.parse(jsonrepair(stripped))
  } catch (_) {
    return null
  }
}

// Normalizes both the new flat shape `{facts, claims, quotes}` and any
// legacy cached output in the old `{signals:[{type,text,confidence}], insufficient}`
// shape. Returns the new shape or null if unrecognized.
export function normalizeSignalsShape(parsed) {
  if (!parsed || typeof parsed !== 'object') return null
  const filterStr = (arr) =>
    Array.isArray(arr) ? arr.filter((s) => typeof s === 'string' && s.trim()) : []
  if ('facts' in parsed || 'claims' in parsed || 'quotes' in parsed) {
    return {
      facts: filterStr(parsed.facts),
      claims: filterStr(parsed.claims),
      quotes: filterStr(parsed.quotes),
    }
  }
  if (Array.isArray(parsed.signals)) {
    const buckets = { facts: [], claims: [], quotes: [] }
    for (const s of parsed.signals) {
      if (!s || typeof s.text !== 'string' || !s.text.trim()) continue
      if (s.type === 'fact') buckets.facts.push(s.text.trim())
      else if (s.type === 'claim') buckets.claims.push(s.text.trim())
      else if (s.type === 'quote') buckets.quotes.push(s.text.trim())
      // speculation / promotion / unclear are dropped — no mapping in new shape
    }
    return buckets
  }
  return null
}

export function parseSummaryOutput(rawText) {
  const stripped = stripThinkTags(rawText)
  const jsonStr = extractJson(stripped)
  const parsed = tryParseStructured(stripped, jsonStr)
  if (!parsed) {
    return { ok: false, error: 'JSON parse error (even after repair)', raw: rawText }
  }
  if (!Array.isArray(parsed.summary) || parsed.summary.length === 0) {
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
  const stripped = stripThinkTags(rawText)
  const jsonStr = extractJsonArray(stripped)
  let parsed
  try {
    parsed = JSON.parse(jsonStr)
  } catch (_) {
    try {
      parsed = JSON.parse(jsonrepair(jsonStr))
    } catch (_) {
      try {
        parsed = JSON.parse(jsonrepair(stripped))
      } catch (e) {
        return { ok: false, error: `JSON parse error: ${e.message}`, raw: rawText }
      }
    }
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
  const stripped = stripThinkTags(rawText)
  const jsonStr = extractJson(stripped)
  const parsed = tryParseStructured(stripped, jsonStr)
  if (!parsed) {
    return { ok: false, error: 'JSON parse error (even after repair)', raw: rawText }
  }
  const data = normalizeSignalsShape(parsed)
  if (!data) {
    return { ok: false, error: 'Unrecognized signals shape', raw: rawText }
  }
  return { ok: true, data }
}
