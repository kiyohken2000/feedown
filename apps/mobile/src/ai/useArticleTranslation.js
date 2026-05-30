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
  temperature: 0.2,
  topP: 0.5,
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

function extractParagraphs(html) {
  let text = html
    .replace(/<\/?(p|h[1-6]|li|blockquote|div|article|section|header|footer|br\s*\/?)(\s[^>]*)?>|<br\s*\/?>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  return text
    .split(/\n{2,}/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 30)
    // Hy-MT2 path translates full article; LFM2.5 path caps inside
    // limitParagraphsForTranslation. Keep the upper bound here generous.
    .slice(0, 200)
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
  const [isTranslating, setIsTranslating] = useState(false)
  const [error, setError] = useState(null)
  const [showTranslated, setShowTranslated] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const pendingRef = useRef(null) // LFM2.5 path (executorch async polling)
  const cancelRef = useRef(false) // Hy-MT2 path (chunk loop break)

  const targetLang = settings.outputLanguage ?? 'ja'
  const useSpecialized =
    settings.translationEngine === 'hy-mt2' && settings.hyMt2Downloaded === true

  const paragraphs = useMemo(() => {
    if (!readerContent?.content) return []
    return extractParagraphs(readerContent.content)
  }, [readerContent?.content])

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

  return {
    paragraphs,
    translatedParagraphs,
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
