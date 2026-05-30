import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  useLLM,
  // TTS: uncomment to re-enable
  // useTextToSpeech,
  // KOKORO_SMALL,
  // KOKORO_VOICE_AF_HEART,
  // KOKORO_VOICE_AF_RIVER,
  // KOKORO_VOICE_AF_SARAH,
  // KOKORO_VOICE_AM_ADAM,
  // KOKORO_VOICE_AM_MICHAEL,
  // KOKORO_VOICE_BF_EMMA,
  // KOKORO_VOICE_BM_DANIEL,
} from 'react-native-executorch'
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher'
import { initLlama } from 'llama.rn'
import {
  FEEDOWN_DEFAULT_LLM_ID,
  FEEDOWN_LLM_MODELS,
  getModelById,
} from '../ai/models'
import {
  DEFAULT_AI_SETTINGS,
  getAiSettings,
  saveAiSettings,
} from '../ai/aiStorage'
import { modelPathFor, toNativePath } from '../ai/llama'

function modelSources(model) {
  if (!model?.executorchModel) return []
  const { modelSource, tokenizerSource, tokenizerConfigSource } = model.executorchModel
  return [modelSource, tokenizerSource, tokenizerConfigSource].filter(Boolean)
}

// TTS: uncomment to re-enable
// const TTS_VOICE_MAP = {
//   af_heart:   KOKORO_VOICE_AF_HEART,
//   af_river:   KOKORO_VOICE_AF_RIVER,
//   af_sarah:   KOKORO_VOICE_AF_SARAH,
//   am_adam:    KOKORO_VOICE_AM_ADAM,
//   am_michael: KOKORO_VOICE_AM_MICHAEL,
//   bf_emma:    KOKORO_VOICE_BF_EMMA,
//   bm_daniel:  KOKORO_VOICE_BM_DANIEL,
// }

const AiContext = createContext(null)

export function AiProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_AI_SETTINGS)
  const [initialized, setInitialized] = useState(false)
  // While a llama.rn session is active we MUST suspend executorch so two
  // engines do not contend for the iOS Metal working set (jetsam OOM risk
  // on 4GB devices). Reflects the orchestrator state below.
  const [llamaActive, setLlamaActive] = useState(false)
  const llamaActiveRef = useRef(false)
  // セッション中に「ダウンロード済み登録済み」かどうかを追跡 (重複 AsyncStorage 書き込み防止)
  const markedRef = useRef(new Set())

  useEffect(() => {
    getAiSettings().then((loaded) => {
      setSettings(loaded)
      setInitialized(true)
    })
  }, [])

  const selectedModel = useMemo(
    () => getModelById(settings.selectedModelId) ?? getModelById(FEEDOWN_DEFAULT_LLM_ID),
    [settings.selectedModelId],
  )

  // preventLoad: AI 無効 / 初期化未完了 / ユーザーが Download を押していない
  // / llama.rn セッションが GPU を占有中
  const llm = useLLM({
    model: selectedModel?.executorchModel ?? FEEDOWN_LLM_MODELS[0].executorchModel,
    preventLoad: !initialized || !settings.enabled || !settings.downloadEnabled || llamaActive,
  })

  // TTS: uncomment to re-enable
  // const selectedVoice = TTS_VOICE_MAP[settings.ttsVoiceId] ?? KOKORO_VOICE_AF_HEART
  // const tts = useTextToSpeech({
  //   model: KOKORO_SMALL,
  //   voice: selectedVoice,
  //   preventLoad: !initialized || !settings.ttsEnabled || !settings.ttsDownloadEnabled,
  // })

  // LLM モデルが ready になったらダウンロード済みリストに記録
  useEffect(() => {
    if (!llm.isReady || !settings.downloadEnabled || !settings.selectedModelId) return
    const modelId = settings.selectedModelId
    if (markedRef.current.has(modelId)) return
    markedRef.current.add(modelId)
    setSettings((prev) => {
      const already = (prev.downloadedModelIds ?? []).includes(modelId)
      if (already) return prev
      const next = {
        ...prev,
        downloadedModelIds: [...(prev.downloadedModelIds ?? []), modelId],
      }
      saveAiSettings(next)
      return next
    })
  }, [llm.isReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // TTS: uncomment to re-enable
  // useEffect(() => {
  //   if (!tts.isReady || !settings.ttsDownloadEnabled || !settings.ttsVoiceId) return
  //   const voiceId = settings.ttsVoiceId
  //   const ttsKey = `tts:${voiceId}`
  //   if (markedRef.current.has(ttsKey)) return
  //   markedRef.current.add(ttsKey)
  //   setSettings((prev) => {
  //     const already = (prev.ttsDownloadedVoiceIds ?? []).includes(voiceId)
  //     if (already) return prev
  //     const next = {
  //       ...prev,
  //       ttsDownloadedVoiceIds: [...(prev.ttsDownloadedVoiceIds ?? []), voiceId],
  //     }
  //     saveAiSettings(next)
  //     return next
  //   })
  // }, [tts.isReady]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateSettings = async (patch) => {
    let next = { ...settings, ...patch }
    if (patch.selectedModelId && patch.selectedModelId !== settings.selectedModelId) {
      const alreadyDownloaded = (settings.downloadedModelIds ?? []).includes(patch.selectedModelId)
      next = { ...next, downloadEnabled: alreadyDownloaded }
    }
    // TTS: uncomment to re-enable
    // if (patch.ttsVoiceId && patch.ttsVoiceId !== settings.ttsVoiceId) {
    //   const alreadyDownloaded = (settings.ttsDownloadedVoiceIds ?? []).includes(patch.ttsVoiceId)
    //   next = { ...next, ttsDownloadEnabled: alreadyDownloaded }
    // }
    setSettings(next)
    await saveAiSettings(next)
  }

  // Returns total bytes on disk for the given model, or 0 if not downloaded
  const getModelSize = useCallback(async (modelId) => {
    const model = getModelById(modelId)
    const sources = modelSources(model)
    if (sources.length === 0) return 0
    try {
      return await ExpoResourceFetcher.getFilesTotalSize(...sources)
    } catch {
      return 0
    }
  }, [])

  // Run a llama.rn (GGUF) session — used by the translation feature with
  // Hy-MT2. Swaps the GPU owner: executorch is suspended (preventLoad=true
  // → useLLM cleanup releases its Metal allocations), then llama.cpp loads
  // the GGUF, the caller drives one or more completions inside `onSession`,
  // then the ctx is released and executorch is allowed to reload (eager on
  // the next render — fine for warm Metal cache).
  //
  // Reject concurrent sessions: callers must serialize.
  //
  // contextParams: passed to initLlama (n_ctx, n_gpu_layers, sampling, ...).
  // onSession(ctx): receives the llama.rn ctx; can call ctx.completion()
  // multiple times. Whatever it returns becomes runWithLlamaRn's return value.
  const runWithLlamaRn = useCallback(async ({ model, contextParams = {}, onSession }) => {
    if (llamaActiveRef.current) {
      throw new Error('llama.rn session already in progress')
    }
    llamaActiveRef.current = true
    setLlamaActive(true)

    // Give executorch a moment to flush its Metal allocations before
    // llama.cpp asks for the GPU working set. Without this the two
    // engines can briefly coexist and trip jetsam on 4GB devices.
    const swapDelayMs = 400

    let ctx = null
    try {
      await new Promise((r) => setTimeout(r, swapDelayMs))
      ctx = await initLlama({
        model: toNativePath(modelPathFor(model)),
        n_ctx: 4096,
        n_gpu_layers: 99,
        ...contextParams,
      })
      return await onSession(ctx)
    } finally {
      try {
        if (ctx) await ctx.release()
      } catch (e) {
        console.warn('[AiContext] llama ctx release failed:', e?.message ?? e)
      }
      llamaActiveRef.current = false
      setLlamaActive(false)
    }
  }, [])

  // Delete the on-disk files for the given model and update settings
  const deleteModel = useCallback(async (modelId) => {
    const model = getModelById(modelId)
    const sources = modelSources(model)
    if (sources.length === 0) return
    await ExpoResourceFetcher.deleteResources(...sources)
    markedRef.current.delete(modelId)
    setSettings((prev) => {
      const next = {
        ...prev,
        downloadedModelIds: (prev.downloadedModelIds ?? []).filter((id) => id !== modelId),
      }
      // If the deleted model is the currently selected one, also disable auto-load
      if (prev.selectedModelId === modelId) {
        next.downloadEnabled = false
      }
      saveAiSettings(next)
      return next
    })
  }, [])

  return (
    <AiContext.Provider
      value={{
        llm,
        settings,
        updateSettings,
        selectedModel,
        initialized,
        getModelSize,
        deleteModel,
        runWithLlamaRn,
        llamaActive,
      }}
    >
      {children}
    </AiContext.Provider>
  )
}

export function useAi() {
  return useContext(AiContext)
}
