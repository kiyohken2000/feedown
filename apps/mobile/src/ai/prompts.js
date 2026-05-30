import { OUTPUT_LANGUAGES } from './aiStorage'

function getLanguageName(code) {
  return OUTPUT_LANGUAGES.find((l) => l.code === code)?.label ?? 'Japanese'
}

// Placeholder phrases used in JSON examples — they must be IN the target
// language so the model sees a same-language continuation as the obvious
// completion. Without this, small models at low temperature mirror the
// article language instead of the requested output language (the example
// values "point 1", "point 2" anchored them to English).
const LANGUAGE_EXAMPLES = {
  ja: { summary: '要点', caveat: '注意点', signalFact: '事実', signalClaim: '主張' },
  en: { summary: 'key point', caveat: 'caveat', signalFact: 'fact', signalClaim: 'claim' },
  ko: { summary: '요점', caveat: '주의사항', signalFact: '사실', signalClaim: '주장' },
  zh: { summary: '要点', caveat: '注意事项', signalFact: '事实', signalClaim: '主张' },
}

function getLanguageExamples(code) {
  return LANGUAGE_EXAMPLES[code] ?? LANGUAGE_EXAMPLES.ja
}

function buildArticleBlock(articleCtx) {
  const publishedStr = articleCtx.publishedAt
    ? new Date(articleCtx.publishedAt).toLocaleDateString('en-US')
    : 'unknown'
  return `Title: ${articleCtx.title}
Feed: ${articleCtx.feedTitle ?? 'unknown'}
Published: ${publishedStr}
Body:
${articleCtx.text}${articleCtx.truncated ? '\n[Body truncated due to length]' : ''}`
}

const BASE_SYSTEM = `You are an RSS article summarization assistant.
Follow these rules strictly:
- Base your answer only on the provided article
- Distinguish speculation from facts
- Write "unknown" when information is unclear
- Return JSON only — no Markdown code blocks, no extra text`

export function buildBriefSummaryMessages(articleCtx, outputLanguage = 'ja') {
  const langName = getLanguageName(outputLanguage)
  const ex = getLanguageExamples(outputLanguage)
  const systemContent = `${BASE_SYSTEM}\n- Output language: ${langName} (all values inside the JSON arrays MUST be written in ${langName})`
  const userContent = `Summarize the following article in 3–5 bullet points in ${langName}.

${buildArticleBlock(articleCtx)}

Write the summary in ${langName}. Output JSON only, no code block:
{"summary":["${ex.summary} 1","${ex.summary} 2","${ex.summary} 3"],"caveats":["${ex.caveat} 1"]}`

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent },
  ]
}

export function buildTechnicalSummaryMessages(articleCtx, outputLanguage = 'ja') {
  const langName = getLanguageName(outputLanguage)
  const ex = getLanguageExamples(outputLanguage)
  const systemContent = `${BASE_SYSTEM}\n- Output language: ${langName} (all values inside the JSON arrays MUST be written in ${langName})`
  const userContent = `Analyze the following article from a technical perspective in ${langName}.
Focus on: technologies mentioned, implementation details, specifications, architectural decisions, and technical trade-offs.
Provide 3–5 bullet points.

${buildArticleBlock(articleCtx)}

Write the analysis in ${langName}. Output JSON only, no code block:
{"summary":["${ex.summary} 1","${ex.summary} 2","${ex.summary} 3"],"caveats":["${ex.caveat} 1"]}`

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent },
  ]
}

export function buildCriticalSummaryMessages(articleCtx, outputLanguage = 'ja') {
  const langName = getLanguageName(outputLanguage)
  const ex = getLanguageExamples(outputLanguage)
  const systemContent = `${BASE_SYSTEM}\n- Output language: ${langName} (all values inside the JSON arrays MUST be written in ${langName})`
  const userContent = `Critically analyze the following article in ${langName}.
Focus on: claims that lack evidence, potential biases, missing context, conflicting information, and questions left unanswered.
Provide 3–5 bullet points.

${buildArticleBlock(articleCtx)}

Write the analysis in ${langName}. Output JSON only, no code block:
{"summary":["${ex.summary} 1","${ex.summary} 2","${ex.summary} 3"],"caveats":["${ex.caveat} 1"]}`

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent },
  ]
}

export function buildSummaryMessages(articleCtx, perspective, outputLanguage = 'ja') {
  if (perspective === 'technical') return buildTechnicalSummaryMessages(articleCtx, outputLanguage)
  if (perspective === 'critical') return buildCriticalSummaryMessages(articleCtx, outputLanguage)
  return buildBriefSummaryMessages(articleCtx, outputLanguage)
}

export function buildSignalsMessages(articleCtx, outputLanguage = 'ja') {
  const langName = getLanguageName(outputLanguage)
  const ex = getLanguageExamples(outputLanguage)
  const systemContent = `${BASE_SYSTEM}\n- Output language: ${langName} (every "text" field MUST be written in ${langName}; "type" and "confidence" stay in English as enum values)`
  const userContent = `Analyze the following article and classify its content by signal type in ${langName}.

Signal types to detect:
- "fact": confirmed dates, numbers, releases, specifications, verified events
- "claim": author's or company's interpretations, opinions, or assertions
- "speculation": predictions, uncertain conclusions, unconfirmed outlooks
- "quote": direct quotes or statements attributed to a specific person or source
- "promotion": product pitches, sign-up prompts, calls-to-action, sponsor language
- "unclear": statements with weak evidence, missing sources, or ambiguous meaning

Rules:
- Extract up to 3 items per signal type that is present in the article
- Omit signal types that are not present
- Keep each item concise (1–2 sentences)
- Assign confidence: "high" (clearly identifiable), "medium" (likely), "low" (ambiguous)
- If the article is too short to classify, set "insufficient": true and return an empty signals array

${buildArticleBlock(articleCtx)}

Write all "text" values in ${langName}. Output JSON only, no code block:
{"signals":[{"type":"fact","text":"${ex.signalFact} 1","confidence":"high"},{"type":"claim","text":"${ex.signalClaim} 1","confidence":"medium"}],"insufficient":false}`

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent },
  ]
}

export function buildChatMessagesForGenerate(articleCtx, chatHistory) {
  const publishedStr = articleCtx.publishedAt
    ? new Date(articleCtx.publishedAt).toLocaleDateString('en-US')
    : 'unknown'

  const systemContent = `You are an article reading assistant. Answer questions strictly based on the article provided below.

Rules:
- Answer only using information from this article
- If the article does not contain enough information to answer, say so clearly
- Distinguish between what the article states as fact vs opinion or speculation
- Keep answers concise and focused
- Do not make up or infer information not present in the article

Article:
Title: ${articleCtx.title}
Feed: ${articleCtx.feedTitle ?? 'unknown'}
Published: ${publishedStr}
Body:
${articleCtx.text}${articleCtx.truncated ? '\n[Body truncated due to length]' : ''}`

  return [
    { role: 'system', content: systemContent },
    ...chatHistory.map((msg) => ({ role: msg.role, content: msg.content })),
  ]
}

export function buildTranslationMessages(paragraphs, targetLanguage) {
  const langName = getLanguageName(targetLanguage)
  const systemContent = `You are a translation assistant. Translate text to ${langName}.
Rules:
- Translate each paragraph faithfully, preserving meaning and tone
- Return JSON only — no Markdown code blocks, no extra text`
  const inputJson = JSON.stringify(paragraphs)
  const userContent = `Translate each paragraph to ${langName}. Return a JSON array with the same number of elements in the same order.

Input:
${inputJson}

Output format (JSON array only, no code block):
["translated paragraph 1","translated paragraph 2",...]`
  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent },
  ]
}

// Hy-MT2's official prompt template for non-Chinese targets: single user
// turn, no system prompt, literal markdown bolding kept to match training.
// Used by the llama.rn translation path (chunk-by-chunk).
export function buildHyMt2TranslationMessages(plainText, targetLanguage) {
  const langName = getLanguageName(targetLanguage)
  return [
    {
      role: 'user',
      content: `Translate the following text into ${langName}. Note that you should **only output the translated result without any additional explanation**:\n\n${plainText}`,
    },
  ]
}

export function buildRepairPromptMessages(originalMessages, brokenRaw) {
  return [
    ...originalMessages,
    { role: 'assistant', content: brokenRaw },
    {
      role: 'user',
      content:
        'Your previous response was not valid JSON. Please output only {"summary":[...],"caveats":[...]} with no code block or explanation.',
    },
  ]
}
