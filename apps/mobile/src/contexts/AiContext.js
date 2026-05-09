import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
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
  const llm = useLLM({
    model: selectedModel?.executorchModel ?? FEEDOWN_LLM_MODELS[0].executorchModel,
    preventLoad: !initialized || !settings.enabled || !settings.downloadEnabled,
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

  return (
    <AiContext.Provider value={{ llm, settings, updateSettings, selectedModel, initialized }}>
      {children}
    </AiContext.Provider>
  )
}

export function useAi() {
  return useContext(AiContext)
}
