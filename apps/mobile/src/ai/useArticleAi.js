import { useEffect, useMemo, useRef, useState } from 'react'
import * as Haptics from 'expo-haptics'
import { useAi } from '../contexts/AiContext'
import { buildArticleContext, truncateForRetry } from './articleContext'
import { buildSummaryMessages, buildSignalsMessages, buildChatMessagesForGenerate, buildRepairPromptMessages } from './prompts'
import { parseSummaryOutput, parseSignalsOutput, stripThinkTags } from './jsonOutput'
import { getSummaryCache, saveSummaryCache, getSignalsCache, saveSignalsCache } from './aiCache'

export const PERSPECTIVES = ['brief', 'technical', 'critical']

// Sampling tuned for JSON-structured output: summary / signals / repair
// all produce a strict JSON shape. The default executorch sampling
// (temp ~0.7) is stochastic enough that small models occasionally drift
// off the JSON contract (extra preamble, truncated arrays, etc.).
// Lower temperature + tighter top-p cuts that variance.
//
// temp=0.3 (not 0.2): at 0.2 the model gets "lazy" about cross-language
// output and mirrors the article language, ignoring the "Output language:
// ja" instruction. 0.3 still cuts JSON-format drift but keeps enough
// flexibility to follow the language switch. Prompt-side fixes
// (language-localized JSON examples) carry the rest of the weight.
//
// minP=0.1: added in v0.9.0. Filters tokens whose probability is < 10%
// of the top token, regardless of temperature. Cuts the long-tail
// junk tokens (random punctuation, stray ASCII) that occasionally
// derail JSON output even at low temperature.
const STRUCTURED_GENERATION_CONFIG = {
  temperature: 0.3,
  topP: 0.6,
  minP: 0.1,
  repetitionPenalty: 1.05,
}

// Chat keeps a more conversational sampling — JSON-style determinism
// would make replies feel robotic.
const CHAT_GENERATION_CONFIG = {
  temperature: 0.7,
  topP: 0.9,
}

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
      console.log(
        `[ai] completion event: isGenerating=false feature=${pendingRef.current.feature} responseLen=${llm.response?.length ?? 0} retryingShort=${pendingRef.current.retryingShort ?? false}`,
      )
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
    // race ガード: 1st generate が失敗して空 response で完了した直後に
    // .catch から短縮 retry がキックされる。useEffect on isGenerating は
    // その失敗の transition も拾うので、ここで空 response + 短縮 retry
    // in-flight なら処理を捨てて短縮 retry の完了を待つ。さもないと repair
    // retry まで起動して executorch に 2 つの generate が同時に乗る。
    if (pending.retryingShort && (!rawResponse || rawResponse.trim().length === 0)) {
      console.log('[ai] handleSummaryComplete: skip (short retry in flight)')
      return
    }
    const parsed = parseSummaryOutput(rawResponse)

    if (parsed.ok) {
      console.log(`[ai] handleSummaryComplete: parsed OK, response=${rawResponse?.length ?? 0} chars`)
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
      console.log(`[ai] handleSummaryComplete: parse failed → repair retry. response=${rawResponse?.length ?? 0} chars`)
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
      console.log(`[ai] handleSummaryComplete: parse failed AGAIN, giving up. response=${rawResponse?.length ?? 0} chars`)
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
    // Reasoning models (Qwen3 etc.) prepend <think>...</think> before the
    // visible answer; strip those so the user never sees the internal
    // reasoning leak through.
    const cleaned = stripThinkTags(rawResponse)
    const trimmed = cleaned?.trim()
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
    llm.configure({ generationConfig: CHAT_GENERATION_CONFIG })
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
    console.log(
      `[ai] generateSummary model=${modelId} perspective=${perspective} text=${articleCtx.text.length} chars source=${articleCtx.contentSource}`,
    )
    pendingRef.current = {
      feature: 'summary',
      articleCtx,
      messages,
      perspective,
      outputLanguage,
      retrying: false,
      retryingShort: false,
    }
    llm.configure({ generationConfig: STRUCTURED_GENERATION_CONFIG })
    llm.generate(messages).catch((err) => {
      handleSummaryGenerateError(err, perspective, outputLanguage)
    })
  }

  // executorch の `Failed to generate text` は context overflow / tokenizer
  // 失敗 / prefill エラーすべて同じ文言で出てくる。一度長さを半減して再試行
  // することで context overflow ならカバーできる。それでもダメなら諦める。
  function handleSummaryGenerateError(err, perspective, outputLanguage) {
    const pending = pendingRef.current
    console.warn(
      `[ai] generateSummary FAILED text=${pending?.articleCtx?.text?.length ?? '?'} chars retryingShort=${pending?.retryingShort ?? false} err=${err?.message ?? err}`,
    )
    if (pending?.feature !== 'summary') return

    const SHORT_RETRY_THRESHOLD = 1500
    if (!pending.retryingShort && pending.articleCtx.text.length > SHORT_RETRY_THRESHOLD) {
      // 段落境界を尊重した truncate (冒頭 + 末尾段落)。raw slice より
      // 結論を保てるが、段落構造が無い記事では fallback で raw slice 相当。
      const shorterText = truncateForRetry(pending.articleCtx.text, SHORT_RETRY_THRESHOLD)
      const shorterCtx = { ...pending.articleCtx, text: shorterText, truncated: true }
      const shorterMessages = buildSummaryMessages(shorterCtx, perspective, outputLanguage)
      // 構造可視化: [...] セパレータ有無で lead/tail 分解された段落構造か、
      // raw slice fallback (段落少ない記事 or 巨大段落) かが判別できる
      const sepIdx = shorterText.indexOf('\n\n[...]\n\n')
      const hasSep = sepIdx >= 0
      const leadLen = hasSep ? sepIdx : shorterText.length
      const tailLen = hasSep ? shorterText.length - sepIdx - 9 : 0
      console.log(
        `[ai] generateSummary retry smart truncate: lead=${leadLen} sep=${hasSep ? 'yes' : 'no'} tail=${tailLen} total=${shorterText.length} (orig ${pending.articleCtx.text.length})`,
      )
      pendingRef.current = {
        ...pending,
        retryingShort: true,
        articleCtx: shorterCtx,
        messages: shorterMessages,
      }
      llm.configure({ generationConfig: STRUCTURED_GENERATION_CONFIG })
      llm.generate(shorterMessages).catch((err2) => {
        console.warn(
          `[ai] generateSummary short-retry FAILED err=${err2?.message ?? err2}`,
        )
        if (pendingRef.current?.feature !== 'summary') return
        setSummaryErrors((prev) => ({
          ...prev,
          [pendingRef.current.perspective]:
            'Model failed to generate. Try a shorter article or a smaller model.',
        }))
        setIsLoadingSummary(false)
        pendingRef.current = null
      })
      return
    }

    setSummaryErrors((prev) => ({
      ...prev,
      [pending.perspective]:
        'Model failed to generate. Try a shorter article or a smaller model.',
    }))
    setIsLoadingSummary(false)
    pendingRef.current = null
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
    llm.configure({ generationConfig: STRUCTURED_GENERATION_CONFIG })
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
