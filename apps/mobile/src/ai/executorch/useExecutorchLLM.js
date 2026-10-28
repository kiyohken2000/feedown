// Stateless LLM hook on top of the react-native-executorch 0.11 new API.
//
// Returns the same shape the app used from the legacy `useLLM` hook
// (isReady / isGenerating / response / error / downloadProgress /
// configure / generate / interrupt / token counts), so useArticleAi,
// useArticleTranslation and the benchmark keep working unchanged.
//
// Why not useLLMChatSession: the chat session owns the conversation history
// and appends every turn to it, while every caller here sends the full
// `messages` array per call (summary / signals / translation are one-shot,
// chat re-sends its own history). So this builds the same pipeline the chat
// session uses — download → tokenizer_config → chat preprocessor → runner —
// and resets the KV cache before each generate.
//
// Why bother: the 0.11 exports have far larger contexts than the 0.9 ones
// the legacy API is pinned to (LFM2.5 1.2B: 2048 → 16384 tokens), so long
// Japanese articles no longer need to be cut in half.

import { useCallback, useEffect, useRef, useState } from 'react'
import RNBlobUtil from 'react-native-blob-util'
import { scheduleOnRN } from 'react-native-worklets'
import { download, llm as rneLlm, wrapAsync } from 'react-native-executorch'

const { createLLMRunner, createChatPreprocessor, parseTokenizerConfig } = rneLlm

// Upper bound per call so a model stuck in a repetition loop can't run all
// the way to the end of a 16k context. Large enough for the LFM translation
// fallback (≈2500 chars in, similar length out).
const DEFAULT_MAX_NEW_TOKENS = 2048

// Prefill chunk size. The runner only checks stop() between forward calls,
// and its default chunk is the model's whole max_seq_len (2048 for LFM2.5):
// one forward over an article-sized chat prompt took 13 s on iPhone 13 mini,
// during which Stop did nothing. Exports whose forward takes fewer tokens
// (Qwen3.5: 1, LFM2.5 MLX: 65) reject a larger prefillLen; for those
// the engine falls back to the model default (see generate).
const PREFILL_CHUNK_TOKENS = 256

function generateWorklet(runner, prompt, genConfig, stopTokens, onToken) {
  'worklet'

  let text = ''
  const stats = runner.generate(prompt, genConfig, (token) => {
    if (stopTokens.includes(token)) return
    text += token
    scheduleOnRN(onToken, token)
  })
  return { text, stats }
}

const generateAsync = wrapAsync(generateWorklet)

function stripStopTokens(text, stopTokens) {
  return stopTokens.reduce((acc, t) => acc.split(t).join(''), text)
}

function isAbortError(e) {
  return e?.code === 'DOWNLOAD_ABORTED' || e?.name === 'AbortError'
}

export function useExecutorchLLM({ model, preventLoad = false }) {
  const [isReady, setIsReady] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [response, setResponse] = useState('')
  const [error, setError] = useState(null)
  const [downloadProgress, setDownloadProgress] = useState(0)

  // { runner, preprocessor, stopTokens } once loaded
  const engineRef = useRef(null)
  // in-flight generate promise, so unload can wait for it before disposing
  const generationRef = useRef(null)
  const genConfigRef = useRef({})
  const lastStatsRef = useRef(null)

  useEffect(() => {
    setError(null)
    setDownloadProgress(0)
    if (preventLoad || !model) return undefined

    const controller = new AbortController()
    let unloaded = false
    let engine = null

    ;(async () => {
      try {
        const local = await download(model, {
          onProgress: setDownloadProgress,
          signal: controller.signal,
        })
        if (unloaded) return
        const configJson = await RNBlobUtil.fs.readFile(local.tokenizerConfigPath, 'utf8')
        const { chatTemplate, bosToken, eosToken, stopTokens } = parseTokenizerConfig(
          JSON.parse(configJson),
        )
        const preprocessor = createChatPreprocessor({ chatTemplate, bosToken, eosToken })
        const runner = await createLLMRunner(local.modelPath, local.tokenizerPath)
        if (unloaded) {
          runner.dispose()
          preprocessor.dispose()
          return
        }
        engine = { runner, preprocessor, stopTokens, prefillLen: PREFILL_CHUNK_TOKENS }
        engineRef.current = engine
        setIsReady(true)
      } catch (e) {
        if (unloaded || isAbortError(e)) return
        console.warn('[executorch] load failed:', e?.message ?? e)
        setError(e)
      }
    })()

    return () => {
      unloaded = true
      controller.abort()
      engineRef.current = null
      setIsReady(false)
      if (!engine) return
      const dispose = () => {
        engine.runner.dispose()
        engine.preprocessor.dispose()
      }
      // Disposing mid-generate would free the model under the worklet; stop
      // it and release once the in-flight call returns.
      const inFlight = generationRef.current
      if (inFlight) {
        engine.runner.stop()
        inFlight.finally(dispose)
      } else {
        dispose()
      }
    }
  }, [model?.modelPath, model?.tokenizerPath, model?.tokenizerConfigPath, preventLoad]) // eslint-disable-line react-hooks/exhaustive-deps

  // Replaces (not merges) the sampling config for the following generate
  // calls. Same field names as the legacy generationConfig (temperature,
  // topP, minP, repetitionPenalty).
  const configure = useCallback(({ generationConfig } = {}) => {
    genConfigRef.current = { ...(generationConfig ?? {}) }
  }, [])

  const onToken = useCallback((token) => {
    setResponse((prev) => prev + token)
  }, [])

  const generate = useCallback(
    async (messages) => {
      const engine = engineRef.current
      if (!engine) throw new Error('Model is not loaded')
      if (generationRef.current) throw new Error('Model is already generating')

      setResponse('')
      setIsGenerating(true)
      lastStatsRef.current = null
      const { enableThinking, ...sampling } = genConfigRef.current
      const run = (async () => {
        engine.runner.reset()
        const prompt = engine.preprocessor.process(messages, messages.length, {
          addGenPrompt: true,
          enableThinking,
        })
        engine.preprocessor.clear()
        const config = { maxNewTokens: DEFAULT_MAX_NEW_TOKENS, ...sampling }
        let result
        try {
          result = await generateAsync(
            engine.runner,
            prompt,
            engine.prefillLen ? { ...config, prefillLen: engine.prefillLen } : config,
            engine.stopTokens,
            onToken,
          )
        } catch (e) {
          if (!engine.prefillLen || !/prefillLen/.test(e?.message ?? '')) throw e
          // This export's forward takes fewer tokens per call; use its default.
          engine.prefillLen = undefined
          engine.runner.reset()
          result = await generateAsync(engine.runner, prompt, config, engine.stopTokens, onToken)
        }
        const { text, stats } = result
        lastStatsRef.current = stats
        return stripStopTokens(text, engine.stopTokens)
      })()
      generationRef.current = run
      try {
        const text = await run
        // Streamed tokens arrive via scheduleOnRN; set the final text so the
        // isGenerating → false effect in callers always sees the full output.
        setResponse(text)
        return text
      } finally {
        generationRef.current = null
        setIsGenerating(false)
      }
    },
    [onToken],
  )

  const interrupt = useCallback(() => {
    engineRef.current?.runner.stop()
  }, [])

  const getGeneratedTokenCount = useCallback(() => lastStatsRef.current?.numTokens ?? 0, [])
  const getPromptTokenCount = useCallback(
    () => lastStatsRef.current?.prefill?.numTokens ?? 0,
    [],
  )

  return {
    isReady,
    isGenerating,
    response,
    error,
    downloadProgress,
    configure,
    generate,
    interrupt,
    getGeneratedTokenCount,
    getPromptTokenCount,
  }
}
