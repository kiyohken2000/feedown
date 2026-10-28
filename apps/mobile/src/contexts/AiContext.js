import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
// TTS: uncomment to re-enable (needs porting to the 0.11 new API first)
/*
import {
  // useTextToSpeech,
  // KOKORO_SMALL,
  // KOKORO_VOICE_AF_HEART,
  // KOKORO_VOICE_AF_RIVER,
  // KOKORO_VOICE_AF_SARAH,
  // KOKORO_VOICE_AM_ADAM,
  // KOKORO_VOICE_AM_MICHAEL,
  // KOKORO_VOICE_BF_EMMA,
  // KOKORO_VOICE_BM_DANIEL,
} from 'react-native-executorch/legacy'
*/
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
import { canRunOnDevice } from '../ai/llama/models'
import { useExecutorchLLM } from '../ai/executorch/useExecutorchLLM'
import {
  deleteModelFiles,
  getDownloadedBytes,
  modelUrls,
  removeLegacyModelFiles,
} from '../ai/executorch/files'

// Bumped when the on-disk executorch model files change format. 2 = the
// react-native-executorch 0.11 new-API exports (v0.11.0), which replace the
// 0.9 / legacy files: those are deleted and every model must be downloaded
// again, so downloadedModelIds is cleared and auto-load is turned off.
const EXECUTORCH_STORE_VERSION = 2

async function migrateExecutorchStore(loaded) {
  if (loaded.executorchStoreVersion === EXECUTORCH_STORE_VERSION) return loaded
  const removed = await removeLegacyModelFiles()
  console.log(`[ai] executorch store → v${EXECUTORCH_STORE_VERSION}: removed ${removed} legacy files`)
  const next = {
    ...loaded,
    executorchStoreVersion: EXECUTORCH_STORE_VERSION,
    downloadedModelIds: [],
    downloadEnabled: false,
  }
  await saveAiSettings(next)
  return next
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
    getAiSettings()
      .then(migrateExecutorchStore)
      .then((loaded) => {
        setSettings(loaded)
        setInitialized(true)
      })
  }, [])

  const selectedModel = useMemo(() => {
    // 保存された selectedModelId が現端末の RAM 要件を満たさない場合
    // (e.g., Gemma 4 を選択済みの状態で 4GB 端末で起動) はデフォルトに
    // フォールバック。useExecutorchLLM がロード試行して jetsam OOM するのを防ぐ。
    const m = getModelById(settings.selectedModelId)
    if (m && canRunOnDevice(m).ok) return m
    return getModelById(FEEDOWN_DEFAULT_LLM_ID)
  }, [settings.selectedModelId])

  // preventLoad: AI 無効 / 初期化未完了 / ユーザーが Download を押していない
  // / llama.rn セッションが GPU を占有中
  const llm = useExecutorchLLM({
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

  // URLs used by the other downloaded models. Models of one family share
  // tokenizer files, so deleting one model must keep those.
  const downloadedIdsRef = useRef([])
  downloadedIdsRef.current = settings.downloadedModelIds ?? []
  const sharedUrlsExcept = useCallback(
    (modelId) =>
      downloadedIdsRef.current
        .filter((id) => id !== modelId)
        .flatMap((id) => modelUrls(getModelById(id)?.executorchModel)),
    [],
  )

  // Returns total bytes on disk for the given model, or 0 if not downloaded
  const getModelSize = useCallback(async (modelId) => {
    const model = getModelById(modelId)
    if (!model?.executorchModel) return 0
    return getDownloadedBytes(model.executorchModel)
  }, [])

  // Run a llama.rn (GGUF) session — used by the translation feature with
  // Hy-MT2. Swaps the GPU owner: executorch is suspended (preventLoad=true
  // → useExecutorchLLM cleanup releases its Metal allocations), then llama.cpp loads
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

  // 進行中の DL を中断する。useExecutorchLLM は単一インスタンスで
  // selectedModel しか追跡しないため、別モデルへの切替や AI 無効化で DL が
  // 中途半端に放棄されると partial file が残る。Cancel ではまず
  // downloadEnabled を落として hook のクリーンアップ (download の abort) を
  // 誘発し、その後 partial を含むファイルを消して次回 DL を clean に始める。
  const cancelDownload = useCallback(async (modelId) => {
    setSettings((prev) => {
      const next = { ...prev, downloadEnabled: false }
      saveAiSettings(next)
      return next
    })
    // preventLoad=true で download が abort される猶予を少し置いてから削除
    await new Promise((r) => setTimeout(r, 300))
    const model = getModelById(modelId)
    if (!model?.executorchModel) return
    await deleteModelFiles(model.executorchModel, sharedUrlsExcept(modelId))
  }, [sharedUrlsExcept])

  // Delete the on-disk files for the given model and update settings
  const deleteModel = useCallback(async (modelId) => {
    const model = getModelById(modelId)
    if (!model?.executorchModel) return
    await deleteModelFiles(model.executorchModel, sharedUrlsExcept(modelId))
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
  }, [sharedUrlsExcept])

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
        cancelDownload,
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
