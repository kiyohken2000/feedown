import { useEffect, useMemo, useRef, useState } from 'react'
import * as Haptics from 'expo-haptics'
import { useAi } from '../contexts/AiContext'
import { detectLanguage } from './languageDetect'
import { buildTranslationMessages } from './prompts'
import { parseTranslationOutput, buildTranslationRepairMessages } from './jsonOutput'
import { getTranslationCache, saveTranslationCache } from './aiCache'

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
    .slice(0, 20)
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
  const { llm, settings, selectedModel } = useAi()
  const [translatedParagraphs, setTranslatedParagraphs] = useState(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [error, setError] = useState(null)
  const [showTranslated, setShowTranslated] = useState(false)
  const pendingRef = useRef(null)

  const targetLang = settings.outputLanguage ?? 'ja'

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
    pendingRef.current = null
  }, [article?.id])

  useEffect(() => {
    if (!llm.isGenerating && pendingRef.current) {
      handleComplete(llm.response)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llm.isGenerating])

  function handleComplete(rawResponse) {
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
      llm.generate(repairMessages)
    } else {
      setError('Translation failed. Please try again.')
      setIsTranslating(false)
      pendingRef.current = null
    }
  }

  const translate = async ({ force = false } = {}) => {
    if (!settings.enabled || !llm.isReady || llm.isGenerating || !paragraphs.length) return

    setError(null)
    setIsTranslating(true)

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

    const messages = buildTranslationMessages(paragraphs, targetLang)
    pendingRef.current = { contentHash, messages, retrying: false }
    llm.generate(messages)
  }

  const interrupt = () => {
    if (llm.isGenerating) {
      llm.interrupt()
      setIsTranslating(false)
      pendingRef.current = null
    }
  }

  const needsTranslation = paragraphs.length > 0 && sourceLang !== targetLang

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
    isModelReady: llm.isReady,
    translate,
    interrupt,
  }
}
