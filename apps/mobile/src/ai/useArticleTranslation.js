import { useEffect, useMemo, useRef, useState } from 'react'
import * as Haptics from 'expo-haptics'
import { useAi } from '../contexts/AiContext'
import { detectLanguage } from './languageDetect'
import { buildTranslationMessages, buildHyMt2TranslationMessages } from './prompts'
import { parseTranslationOutput, buildTranslationRepairMessages } from './jsonOutput'
import { getTranslationCache, saveTranslationCache } from './aiCache'
import { splitParagraphsIntoChunks } from './translationChunks'
import { HY_MT2_TRANSLATION_MODEL, HY_MT2_SAMPLING } from './llama/models'

// Translation outputs a strict JSON array via the LFM2.5 path; low
// temperature reduces parse-failure rate (same rationale as
// useArticleAi's STRUCTURED_GENERATION_CONFIG).
const LFM_TRANSLATION_GENERATION_CONFIG = {
  temperature: 0.3,
  topP: 0.6,
  repetitionPenalty: 1.05,
}

// LFM2.5 path keeps a hard 2500-char cap because JSON-formatted output
// degrades with longer inputs (Phase E). Hy-MT2 path translates the full
// article via chunking — see translateWithHyMt2.
function limitParagraphsForTranslation(paragraphs, maxChars = 2500) {
  const result = []
  let total = 0
  for (const p of paragraphs) {
    if (total + p.length > maxChars) break
    result.push(p)
    total += p.length
  }
  return result.length > 0 ? result : paragraphs.slice(0, 1)
}

// Walks reader HTML and emits an ordered block list of text paragraphs and
// images. Used by the Translated view to interleave images at their original
// position — Original (HTML render) shows them inline, so Translated should
// too.
//
// Images are extracted FIRST as sentinels, then the existing tag-strip /
// entity-decode logic runs on the rest, then we re-split into text/image
// blocks in order.
function extractBlocks(html) {
  const imageStore = []
  let normalized = html.replace(/<img\s+[^>]*>/gi, (match) => {
    const srcMatch = match.match(/src=["']([^"']+)["']/i)
    const altMatch = match.match(/alt=["']([^"']*)["']/i)
    const src = srcMatch?.[1] ?? ''
    if (!src) return ''
    const idx = imageStore.length
    imageStore.push({ src, alt: altMatch?.[1] ?? '' })
    return `\n\n[[__IMG_${idx}__]]\n\n`
  })

  normalized = normalized
    .replace(/<\/?(p|h[1-6]|li|blockquote|div|article|section|header|footer|br\s*\/?)(\s[^>]*)?>|<br\s*\/?>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  const segments = normalized
    .split(/\n{2,}/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const blocks = []
  for (const seg of segments) {
    const imgMatch = seg.match(/^\[\[__IMG_(\d+)__\]\]$/)
    if (imgMatch) {
      const img = imageStore[parseInt(imgMatch[1], 10)]
      if (img) blocks.push({ type: 'image', src: img.src, alt: img.alt })
      continue
    }
    if (seg.length >= 30) {
      blocks.push({ type: 'text', content: seg })
    }
  }
  // Generous safety cap; matches the previous .slice(0, 200) bound but
  // counts both text and image blocks.
  return blocks.slice(0, 250)
}

// From the block list, derive the paragraph array (text-only, in order)
// AND a Map<paragraphIndex, image[]> recording which images immediately
// follow each paragraph. Images preceding the first paragraph are kept
// separately so the renderer can hoist them to the top.
function deriveBlockMappings(blocks) {
  const paragraphs = []
  const imagesAfterParagraph = new Map()
  const imagesBeforeFirstParagraph = []
  let lastParaIdx = -1
  for (const b of blocks) {
    if (b.type === 'text') {
      paragraphs.push(b.content)
      lastParaIdx = paragraphs.length - 1
    } else if (b.type === 'image') {
      if (lastParaIdx === -1) {
        imagesBeforeFirstParagraph.push(b)
      } else {
        if (!imagesAfterParagraph.has(lastParaIdx)) imagesAfterParagraph.set(lastParaIdx, [])
        imagesAfterParagraph.get(lastParaIdx).push(b)
      }
    }
  }
  return { paragraphs, imagesAfterParagraph, imagesBeforeFirstParagraph }
}

function readerHash(content) {
  let h = 5381
  const sample = content.slice(0, 300)
  for (let i = 0; i < sample.length; i++) {
    h = ((h << 5) + h) + sample.charCodeAt(i)
    h = h & h
  }
  return (h >>> 0).toString(36)
}

export function useArticleTranslation(article, readerContent) {
  const { llm, settings, selectedModel, runWithLlamaRn } = useAi()
  const [translatedParagraphs, setTranslatedParagraphs] = useState(null)
  // The chunks used to translate (Hy-MT2 path only). Lets the Translated
  // view know which source paragraphs each translation entry covers, so
  // we can interleave the corresponding images at the right boundaries.
  const [translationChunks, setTranslationChunks] = useState(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [error, setError] = useState(null)
  const [showTranslated, setShowTranslated] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const pendingRef = useRef(null) // LFM2.5 path (executorch async polling)
  const cancelRef = useRef(false) // Hy-MT2 path (chunk loop break)

  const targetLang = settings.outputLanguage ?? 'ja'
  const useSpecialized =
    settings.translationEngine === 'hy-mt2' && settings.hyMt2Downloaded === true

  const blocks = useMemo(() => {
    if (!readerContent?.content) return []
    return extractBlocks(readerContent.content)
  }, [readerContent?.content])

  const blockMappings = useMemo(() => deriveBlockMappings(blocks), [blocks])
  const paragraphs = blockMappings.paragraphs

  const sourceLang = useMemo(() => {
    if (!paragraphs.length) return 'en'
    return detectLanguage(paragraphs.join(' '))
  }, [paragraphs])

  const contentHash = useMemo(() => {
    if (!readerContent?.content) return ''
    return readerHash(readerContent.content)
  }, [readerContent?.content])

  // Reset when article changes
  useEffect(() => {
    setTranslatedParagraphs(null)
    setTranslationChunks(null)
    setIsTranslating(false)
    setError(null)
    setShowTranslated(false)
    setProgress({ current: 0, total: 0 })
    pendingRef.current = null
    cancelRef.current = false
  }, [article?.id])

  // LFM2.5 path: poll for executorch completion
  useEffect(() => {
    if (!llm.isGenerating && pendingRef.current) {
      handleLfmComplete(llm.response)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llm.isGenerating])

  function handleLfmComplete(rawResponse) {
    const pending = pendingRef.current
    if (!pending) return

    const parsed = parseTranslationOutput(rawResponse)
    if (parsed.ok) {
      const modelId = selectedModel?.id ?? 'unknown'
      saveTranslationCache(article.id, pending.contentHash, modelId, targetLang, parsed.data)
      setTranslatedParagraphs(parsed.data)
      // LFM path: 1 translated entry per source paragraph (capped earlier).
      // Build a virtual chunk array so the renderer can place images by
      // the same logic as the Hy-MT2 path.
      setTranslationChunks(parsed.data.map((_, i) => ({ paragraphIndices: [i] })))
      setIsTranslating(false)
      setShowTranslated(true)
      pendingRef.current = null
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } else if (!pending.retrying) {
      const repairMessages = buildTranslationRepairMessages(pending.messages, rawResponse)
      pendingRef.current = { ...pending, retrying: true, messages: repairMessages }
      llm.generate(repairMessages).catch((err) => {
        console.error('Translation repair error:', err)
        setError('Translation failed. Please try again.')
        setIsTranslating(false)
        pendingRef.current = null
      })
    } else {
      setError('Translation failed. Please try again.')
      setIsTranslating(false)
      pendingRef.current = null
    }
  }

  // LFM2.5 (executorch) — short article, 1 LLM call, JSON I/O.
  async function translateWithLfm({ force }) {
    if (!llm.isReady || llm.isGenerating) return
    const modelId = selectedModel?.id ?? 'unknown'

    if (!force) {
      const cached = await getTranslationCache(article.id, contentHash, modelId, targetLang)
      if (cached) {
        setTranslatedParagraphs(cached)
        setTranslationChunks(cached.map((_, i) => ({ paragraphIndices: [i] })))
        setIsTranslating(false)
        setShowTranslated(true)
        return
      }
    }

    setError(null)
    setIsTranslating(true)
    const limitedParagraphs = limitParagraphsForTranslation(paragraphs)
    const messages = buildTranslationMessages(limitedParagraphs, targetLang)
    pendingRef.current = { contentHash, messages, retrying: false }
    llm.configure({ generationConfig: LFM_TRANSLATION_GENERATION_CONFIG })
    llm.generate(messages).catch((err) => {
      console.error('Translation generate error:', err)
      setError('Translation failed. Please try again.')
      setIsTranslating(false)
      pendingRef.current = null
    })
  }

  // Hy-MT2 (llama.rn) — full article, chunked, progressive, cancellable.
  async function translateWithHyMt2({ force }) {
    const engineId = HY_MT2_TRANSLATION_MODEL.id

    if (!force) {
      const cached = await getTranslationCache(article.id, contentHash, engineId, targetLang)
      if (cached) {
        setTranslatedParagraphs(cached)
        // Re-derive chunk structure from current paragraphs — the contentHash
        // match guarantees the source paragraphs (and therefore the chunk
        // boundaries) are identical to when this cache was written.
        setTranslationChunks(splitParagraphsIntoChunks(paragraphs, 2500))
        setIsTranslating(false)
        setShowTranslated(true)
        return
      }
    }

    const chunks = splitParagraphsIntoChunks(paragraphs, 2500)
    if (chunks.length === 0) return

    setError(null)
    setIsTranslating(true)
    setShowTranslated(true)
    setTranslatedParagraphs([])
    setTranslationChunks(chunks)
    setProgress({ current: 0, total: chunks.length })
    cancelRef.current = false

    try {
      const collected = await runWithLlamaRn({
        model: HY_MT2_TRANSLATION_MODEL,
        contextParams: { n_ctx: 4096 },
        onSession: async (ctx) => {
          const out = []
          for (let i = 0; i < chunks.length; i++) {
            if (cancelRef.current) break
            const messages = buildHyMt2TranslationMessages(chunks[i].text, targetLang)
            const completion = await ctx.completion({
              messages,
              n_predict: 2048,
              temperature: HY_MT2_SAMPLING.temperature,
              top_p: HY_MT2_SAMPLING.top_p,
              top_k: HY_MT2_SAMPLING.top_k,
              penalty_repeat: HY_MT2_SAMPLING.penalty_repeat,
              stop: ['</s>', '<|endoftext|>', '<end_of_turn>', '<|eos|>'],
            })
            if (cancelRef.current) break
            const text = (completion?.text ?? completion?.content ?? '').trim()
            out.push(text)
            setTranslatedParagraphs((prev) => [...(prev ?? []), text])
            setProgress({ current: i + 1, total: chunks.length })
          }
          return out
        },
      })

      if (!cancelRef.current && collected.length === chunks.length) {
        await saveTranslationCache(article.id, contentHash, engineId, targetLang, collected)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
    } catch (err) {
      console.error('[useArticleTranslation] hy-mt2 error:', err)
      setError(err?.message ?? 'Translation failed. Please try again.')
    } finally {
      setIsTranslating(false)
      cancelRef.current = false
    }
  }

  const translate = async ({ force = false } = {}) => {
    if (!settings.enabled || !paragraphs.length) return
    if (useSpecialized) {
      await translateWithHyMt2({ force })
    } else {
      await translateWithLfm({ force })
    }
  }

  const interrupt = () => {
    if (useSpecialized) {
      // Set the flag; the chunk loop exits between chunks. Mid-chunk
      // ctx.completion cannot be interrupted in this version (would need
      // a separate ctx.stopCompletion path).
      cancelRef.current = true
    } else if (llm.isGenerating) {
      llm.interrupt()
      setIsTranslating(false)
      pendingRef.current = null
    }
  }

  const needsTranslation = paragraphs.length > 0 && sourceLang !== targetLang
  const isModelReady = useSpecialized ? settings.hyMt2Downloaded === true : llm.isReady

  // Combine translated text with image blocks at their original positions,
  // ready for the Translated view to render with no extra logic.
  const translatedBlocks = useMemo(() => {
    if (!translatedParagraphs || !translationChunks) return null
    const result = []
    for (const img of blockMappings.imagesBeforeFirstParagraph) {
      result.push({ type: 'image', src: img.src, alt: img.alt })
    }
    for (let i = 0; i < translatedParagraphs.length; i++) {
      const text = translatedParagraphs[i]
      if (typeof text === 'string' && text.length > 0) {
        result.push({ type: 'text', content: text })
      }
      const indices = translationChunks[i]?.paragraphIndices ?? []
      const lastIdx = indices.length ? Math.max(...indices) : -1
      if (lastIdx >= 0) {
        const imgs = blockMappings.imagesAfterParagraph.get(lastIdx) ?? []
        for (const img of imgs) {
          result.push({ type: 'image', src: img.src, alt: img.alt })
        }
      }
    }
    return result
  }, [translatedParagraphs, translationChunks, blockMappings])

  return {
    paragraphs,
    translatedParagraphs,
    translatedBlocks,
    isTranslating: isTranslating || (llm.isGenerating && !!pendingRef.current),
    error,
    showTranslated,
    setShowTranslated,
    sourceLang,
    targetLang,
    needsTranslation,
    isModelReady,
    translate,
    interrupt,
    progress,
    engine: useSpecialized ? 'hy-mt2' : 'lfm',
  }
}
