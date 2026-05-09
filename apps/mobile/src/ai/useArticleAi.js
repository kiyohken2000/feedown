import { useEffect, useMemo, useRef, useState } from 'react'
import * as Haptics from 'expo-haptics'
import { useAi } from '../contexts/AiContext'
import { buildArticleContext } from './articleContext'
import { buildSummaryMessages, buildSignalsMessages, buildChatMessagesForGenerate, buildRepairPromptMessages } from './prompts'
import { parseSummaryOutput, parseSignalsOutput } from './jsonOutput'
import { getSummaryCache, saveSummaryCache, getSignalsCache, saveSignalsCache } from './aiCache'

export const PERSPECTIVES = ['brief', 'technical', 'critical']

export function useArticleAi(article, readerContent = null) {
  const { llm, settings, selectedModel } = useAi()

  // Summary state (per perspective)
  const [summaryResults, setSummaryResults] = useState({})
  const [summaryErrors, setSummaryErrors] = useState({})
  const [currentPerspective, setCurrentPerspective] = useState('brief')

  // Signals state
  const [signalsResult, setSignalsResult] = useState(null)
  const [signalsError, setSignalsError] = useState(null)

  // Chat state
  const [chatHistory, setChatHistory] = useState([])
  const [chatError, setChatError] = useState(null)

  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  const [isLoadingSignals, setIsLoadingSignals] = useState(false)
  const [isLoadingChat, setIsLoadingChat] = useState(false)

  // { feature: 'summary'|'signals', perspective?, articleCtx, messages, outputLanguage, retrying }
  const pendingRef = useRef(null)

  const maxInputChars = selectedModel?.maxInputChars
  const articleCtx = useMemo(
    () => buildArticleContext(article, readerContent, maxInputChars),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [article.id, article.description, readerContent?.content, maxInputChars],
  )

  // Reset all state when article changes
  useEffect(() => {
    setSummaryResults({})
    setSummaryErrors({})
    setCurrentPerspective('brief')
    setSignalsResult(null)
    setSignalsError(null)
    setChatHistory([])
    setChatError(null)
    setIsLoadingSummary(false)
    setIsLoadingSignals(false)
    setIsLoadingChat(false)
    pendingRef.current = null
  }, [articleCtx.articleId])

  // Auto-load cached results on article open
  useEffect(() => {
    if (!selectedModel) return
    const modelId = selectedModel.id
    const outputLanguage = settings.outputLanguage ?? 'ja'

    async function loadCache() {
      const summaryResults = {}
      for (const perspective of PERSPECTIVES) {
        const cached = await getSummaryCache(
          articleCtx.articleId,
          articleCtx.contentHash,
          modelId,
          perspective,
          outputLanguage,
        )
        if (cached) summaryResults[perspective] = cached
      }
      if (Object.keys(summaryResults).length > 0) {
        setSummaryResults((prev) => ({ ...prev, ...summaryResults }))
      }

      const cachedSignals = await getSignalsCache(
        articleCtx.articleId,
        articleCtx.contentHash,
        modelId,
        outputLanguage,
      )
      if (cachedSignals) setSignalsResult(cachedSignals)
    }

    loadCache()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleCtx.articleId, selectedModel?.id, settings.outputLanguage])

  // Completion handler
  useEffect(() => {
    if (!llm.isGenerating && pendingRef.current) {
      handleGenerationComplete(llm.response)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llm.isGenerating])

  function handleGenerationComplete(rawResponse) {
    const pending = pendingRef.current
    if (!pending) return

    if (pending.feature === 'signals') {
      handleSignalsComplete(rawResponse, pending)
    } else if (pending.feature === 'chat') {
      handleChatComplete(rawResponse, pending)
    } else {
      handleSummaryComplete(rawResponse, pending)
    }
  }

  function handleSummaryComplete(rawResponse, pending) {
    const parsed = parseSummaryOutput(rawResponse)

    if (parsed.ok) {
      const modelId = selectedModel?.id ?? 'unknown'
      saveSummaryCache(
        pending.articleCtx.articleId,
        pending.articleCtx.contentHash,
        modelId,
        pending.perspective,
        pending.outputLanguage,
        parsed.data,
      )
      setSummaryResults((prev) => ({ ...prev, [pending.perspective]: parsed.data }))
      setIsLoadingSummary(false)
      pendingRef.current = null
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } else if (!pending.retrying) {
      const repairMessages = buildRepairPromptMessages(pending.messages, rawResponse)
      pendingRef.current = { ...pending, retrying: true, messages: repairMessages }
      llm.generate(repairMessages).catch((err) => {
        console.warn('LLM repair generate failed:', err)
        const cur = pendingRef.current
        if (cur?.feature !== 'summary') return
        setSummaryErrors((prev) => ({
          ...prev,
          [cur.perspective]: 'Model failed to generate. Try a shorter article or a smaller model.',
        }))
        setIsLoadingSummary(false)
        pendingRef.current = null
      })
    } else {
      setSummaryErrors((prev) => ({
        ...prev,
        [pending.perspective]: 'Failed to generate summary. Please try again.',
      }))
      setIsLoadingSummary(false)
      pendingRef.current = null
    }
  }

  function handleSignalsComplete(rawResponse, pending) {
    const parsed = parseSignalsOutput(rawResponse)

    if (parsed.ok) {
      const modelId = selectedModel?.id ?? 'unknown'
      saveSignalsCache(
        pending.articleCtx.articleId,
        pending.articleCtx.contentHash,
        modelId,
        pending.outputLanguage,
        parsed.data,
      )
      setSignalsResult(parsed.data)
      setIsLoadingSignals(false)
      pendingRef.current = null
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } else if (!pending.retrying) {
      const repairMessages = buildRepairPromptMessages(pending.messages, rawResponse)
      pendingRef.current = { ...pending, retrying: true, messages: repairMessages }
      llm.generate(repairMessages).catch((err) => {
        console.warn('LLM repair generate failed:', err)
        if (pendingRef.current?.feature !== 'signals') return
        setSignalsError('Model failed to generate. Try a shorter article or a smaller model.')
        setIsLoadingSignals(false)
        pendingRef.current = null
      })
    } else {
      setSignalsError('Failed to analyze signals. Please try again.')
      setIsLoadingSignals(false)
      pendingRef.current = null
    }
  }

  function handleChatComplete(rawResponse, pending) {
    const trimmed = rawResponse?.trim()
    if (!trimmed) {
      setChatError('No response received. Please try again.')
      setIsLoadingChat(false)
      pendingRef.current = null
      return
    }
    const assistantMsg = {
      id: Date.now().toString(),
      role: 'assistant',
      content: trimmed,
      createdAt: new Date().toISOString(),
    }
    setChatHistory((prev) => [...prev, assistantMsg])
    setChatError(null)
    setIsLoadingChat(false)
    pendingRef.current = null
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  const sendChatMessage = async (text) => {
    if (!settings.enabled || !llm.isReady || llm.isGenerating) return
    const trimmed = text?.trim()
    if (!trimmed) return

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    }
    const nextHistory = [...chatHistory, userMsg]
    setChatHistory(nextHistory)
    setChatError(null)
    setIsLoadingChat(true)

    const messages = buildChatMessagesForGenerate(articleCtx, nextHistory)
    pendingRef.current = { feature: 'chat', articleCtx }
    llm.generate(messages).catch((err) => {
      console.warn('LLM chat generate failed:', err)
      if (pendingRef.current?.feature !== 'chat') return
      setChatError('Model failed to generate. Try a shorter article or a smaller model.')
      setIsLoadingChat(false)
      pendingRef.current = null
    })
  }

  const clearChat = () => {
    setChatHistory([])
    setChatError(null)
  }

  const generateSummary = async (perspective = currentPerspective, { force = false } = {}) => {
    if (!settings.enabled || !llm.isReady || llm.isGenerating) return

    setSummaryErrors((prev) => ({ ...prev, [perspective]: null }))
    setSummaryResults((prev) => ({ ...prev, [perspective]: null }))
    setIsLoadingSummary(true)

    const modelId = selectedModel?.id ?? 'unknown'
    const outputLanguage = settings.outputLanguage ?? 'ja'

    if (!force) {
      const cached = await getSummaryCache(
        articleCtx.articleId,
        articleCtx.contentHash,
        modelId,
        perspective,
        outputLanguage,
      )
      if (cached) {
        setSummaryResults((prev) => ({ ...prev, [perspective]: cached }))
        setIsLoadingSummary(false)
        return
      }
    }

    const messages = buildSummaryMessages(articleCtx, perspective, outputLanguage)
    pendingRef.current = { feature: 'summary', articleCtx, messages, perspective, outputLanguage, retrying: false }
    llm.generate(messages).catch((err) => {
      console.warn('LLM summary generate failed:', err)
      if (pendingRef.current?.feature !== 'summary') return
      setSummaryErrors((prev) => ({
        ...prev,
        [pendingRef.current.perspective]: 'Model failed to generate. Try a shorter article or a smaller model.',
      }))
      setIsLoadingSummary(false)
      pendingRef.current = null
    })
  }

  const generateSignals = async ({ force = false } = {}) => {
    if (!settings.enabled || !llm.isReady || llm.isGenerating) return

    setSignalsError(null)
    setSignalsResult(null)
    setIsLoadingSignals(true)

    const modelId = selectedModel?.id ?? 'unknown'
    const outputLanguage = settings.outputLanguage ?? 'ja'

    if (!force) {
      const cached = await getSignalsCache(
        articleCtx.articleId,
        articleCtx.contentHash,
        modelId,
        outputLanguage,
      )
      if (cached) {
        setSignalsResult(cached)
        setIsLoadingSignals(false)
        return
      }
    }

    const messages = buildSignalsMessages(articleCtx, outputLanguage)
    pendingRef.current = { feature: 'signals', articleCtx, messages, outputLanguage, retrying: false }
    llm.generate(messages).catch((err) => {
      console.warn('LLM signals generate failed:', err)
      if (pendingRef.current?.feature !== 'signals') return
      setSignalsError('Model failed to generate. Try a shorter article or a smaller model.')
      setIsLoadingSignals(false)
      pendingRef.current = null
    })
  }

  const switchPerspective = (perspective) => {
    setCurrentPerspective(perspective)
  }

  const interrupt = () => {
    if (llm.isGenerating) {
      llm.interrupt()
      setIsLoadingSummary(false)
      setIsLoadingSignals(false)
      pendingRef.current = null
    }
  }

  const activePerspective = pendingRef.current?.feature === 'summary'
    ? pendingRef.current.perspective
    : currentPerspective

  return {
    articleCtx,
    // Summary
    summaryResults,
    currentPerspective,
    activePerspective,
    switchPerspective,
    isGeneratingSummary: isLoadingSummary || (llm.isGenerating && pendingRef.current?.feature === 'summary'),
    summaryErrors,
    generateSummary,
    // Signals
    signalsResult,
    signalsError,
    isGeneratingSignals: isLoadingSignals || (llm.isGenerating && pendingRef.current?.feature === 'signals'),
    generateSignals,
    // Chat
    chatHistory,
    chatError,
    isGeneratingChat: isLoadingChat || (llm.isGenerating && pendingRef.current?.feature === 'chat'),
    sendChatMessage,
    clearChat,
    // Shared
    isGenerating: llm.isGenerating,
    interrupt,
    isModelReady: llm.isReady,
    downloadProgress: llm.downloadProgress,
    llmError: llm.error,
  }
}
