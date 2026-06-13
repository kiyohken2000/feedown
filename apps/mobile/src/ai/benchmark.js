import { useCallback, useEffect, useRef, useState } from 'react'
import { useAi } from '../contexts/AiContext'
import { FEEDOWN_LLM_MODELS } from './models'
import { HY_MT2_TRANSLATION_MODEL, HY_MT2_SAMPLING } from './llama/models'

// 固定プロンプト 3 本 (summary 系モデル用)。reproducibility 優先で英語のみ、
// トークナイザ依存の言語差を排除する。
export const BENCHMARK_PROMPTS_SUMMARY = [
  {
    id: 'short',
    label: 'Short prompt',
    text:
      'Summarize in one sentence (under 30 words): React Native lets developers build native mobile apps using JavaScript and React, sharing most code between iOS and Android.',
  },
  {
    id: 'medium',
    label: 'Medium prompt',
    text:
      'Summarize the following article in 2 sentences:\n\n' +
      'A team at the European Space Agency announced this week that its experimental ion-thruster prototype completed a 72-hour continuous fire test in vacuum without degradation. ' +
      'The thruster operates at 12 kilowatts, delivers a specific impulse of 4,200 seconds, and reached 80 percent of its design thrust during the run. ' +
      'Engineers said the next milestone is a 1,000-hour endurance campaign starting in early autumn, with flight qualification targeted for a small cargo tug mission in 2028.',
  },
  {
    id: 'long',
    label: 'Long prompt',
    text:
      'Summarize the following article in 3 sentences:\n\n' +
      'Researchers at a coastal climate observatory published a five-year analysis of surface salinity in the eastern North Atlantic, finding a small but consistent freshening signal between 200 and 400 meters depth that they attribute to changes in winter mixed-layer ventilation. ' +
      'The study combined 1.4 million Argo float profiles with shipboard CTD casts from twelve research cruises, and used a new bias-correction model that the team trained on overlapping float-CTD pairs in the Iceland Basin. ' +
      'Lead author Dr. Helena Voss said the freshening corresponds to roughly 0.02 practical salinity units per decade, which is small in absolute terms but enough to shift the depth of the seasonal mixed layer by 8 to 15 meters under typical winter conditions. ' +
      'The paper argues that this redistribution of buoyancy affects how the subpolar gyre exchanges heat with the atmosphere, and may partly account for the unexpected weakening of deep convection that float data have recorded since 2021. ' +
      'Co-author Dr. Marcus Lindqvist cautioned that the signal is at the edge of the instrument noise floor for older float generations and that the eastern basin coverage remains thinner than the Labrador Sea. ' +
      'A follow-up campaign with two new autonomous gliders is planned for next year to fill the coverage gap and to attempt direct turbulence measurements during the deepest mixing events.',
  },
]

// 翻訳モデル用の固定プロンプト 3 本 (EN → JA)。decode 出力長がほぼ入力長に
// 比例するため summary 用より短めに設定 — 長尺だと benchmark 1 本で >20s
// かかり実用上の比較がしづらいため。
export const BENCHMARK_PROMPTS_TRANSLATION = [
  {
    id: 'short',
    label: 'Short prompt',
    text:
      'The morning fog over the harbor began to lift just after sunrise, revealing rows of small boats tied to the wooden pier.',
  },
  {
    id: 'medium',
    label: 'Medium prompt',
    text:
      'A research team at the university announced that their new battery prototype reached 92 percent of its design capacity after 1,500 charge cycles, which they say is roughly double the lifetime of comparable commercial cells. ' +
      'The team plans to publish a peer-reviewed paper later this year and is in early talks with two manufacturers about licensing the technology for use in consumer electronics.',
  },
  {
    id: 'long',
    label: 'Long prompt',
    text:
      'In a quiet coastal village on the northern edge of the prefecture, residents have spent the past decade rebuilding a traditional fishing port that had been damaged by a series of storms in the early 2010s. ' +
      'The reconstruction effort, funded largely through community donations and a small national grant, prioritized restoring the original wooden walkways and stone breakwaters rather than replacing them with concrete. ' +
      'Local historians argued that the original materials were better suited to the bay’s tidal patterns and that the restored port would attract more visitors interested in regional heritage. ' +
      'A small museum opened next to the harbor last spring, displaying tools, photographs, and oral histories collected from older fishermen who had worked the port in the postwar decades.',
  },
]

// 翻訳ターゲット言語 (Hy-MT2 prompt 構築用)。固定で日本語 — 比較のため
// targetLang を benchmark 中に変えない。
const BENCHMARK_TRANSLATION_TARGET = 'Japanese'

function buildHyMt2PromptText(sourceText) {
  return `Translate the following text into ${BENCHMARK_TRANSLATION_TARGET}. Note that you should **only output the translated result without any additional explanation**:\n\n${sourceText}`
}

const EXECUTORCH_GENERATION_CONFIG = {
  temperature: 0.3,
  topP: 0.6,
  minP: 0.1,
}

// Benchmark 対象モデル一覧 (canonical)。Benchmark 画面はこのリストから
// ダウンロード済みのものだけを表示する。
//   backend: 'executorch' | 'llama.rn'
//   kind:    'summary'    | 'translation'  — verdict 閾値の切替に使う
export const ALL_BENCHMARK_MODELS = [
  ...FEEDOWN_LLM_MODELS.map((m) => ({
    id: m.id,
    displayName: m.displayName,
    notes: m.notes,
    executorchModel: m.executorchModel,
    backend: 'executorch',
    kind: 'summary',
  })),
  {
    id: HY_MT2_TRANSLATION_MODEL.id,
    displayName: HY_MT2_TRANSLATION_MODEL.displayName,
    notes: 'Translation specialist (1.13 GB)',
    llamaModel: HY_MT2_TRANSLATION_MODEL,
    backend: 'llama.rn',
    kind: 'translation',
  },
]

export function getBenchmarkModelById(id) {
  return ALL_BENCHMARK_MODELS.find((m) => m.id === id) ?? null
}

// performance.now() は React Native でも利用可能 (Hermes)。
function now() {
  return typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now()
}

// ---- Verdict ---------------------------------------------------------------

// avg decode rate (chars/sec) + long-prompt TTFT で snappy/good/slow/poor の
// 4 段階で評価。summary と translation で閾値を分ける — translation は
// decode 量が出力長に比例するため decode rate を重視、TTFT は無視。
//
// 閾値は A15 (iPhone 13 mini) で実測した LFM2.5 1.2B の感触に合わせている:
//   - LFM2.5 1.2B: ~200 ch/s decode、long prompt TTFT ~3s → 'good'
//   - Qwen3 0.6B:  ~280 ch/s decode、long prompt TTFT ~2s → 'snappy'/'good'
//   - 2B 級:       ~80 ch/s decode、long prompt TTFT ~8s → 'slow'
//
// 必要に応じて将来 calibration し直す。
export function evaluateResult(result, kind = 'summary') {
  const prompts = result?.prompts ?? []
  if (prompts.length === 0) {
    return { tier: 'unknown', label: 'No data', detail: '' }
  }
  const avgRate =
    prompts.reduce((s, p) => s + (p.charsPerSec ?? 0), 0) / prompts.length
  const longPrompt = prompts.find((p) => p.promptId === 'long')
  const longTtftMs = longPrompt?.ttftMs ?? 0

  if (kind === 'translation') {
    // 翻訳: decode rate を主指標 (article 全体翻訳の体感が出力長で決まる)
    if (avgRate >= 150) {
      return {
        tier: 'snappy',
        label: '✓ Snappy',
        detail: 'Real-time feel for paragraph-by-paragraph translation.',
      }
    }
    if (avgRate >= 80) {
      const sec = Math.round(5000 / avgRate)
      return {
        tier: 'good',
        label: '✓ Practical',
        detail: `Practical for full-article translation (~${sec}s for a 5000-char article).`,
      }
    }
    if (avgRate >= 40) {
      const sec = Math.round(5000 / avgRate)
      return {
        tier: 'slow',
        label: '△ Usable but slow',
        detail: `Expect ~${sec}s for a 5000-char article. OK for short reads, painful for long ones.`,
      }
    }
    // poor tier: 数字は厳しいが「翻訳専用モデルとしての唯一の選択肢」
    // という現実を踏まえて wording は dismissive にしない。Hy-MT2 は
    // 速度より品質を優先するユーザ向けに feedown が出荷している。
    const sec = avgRate > 0 ? Math.round(5000 / avgRate) : 0
    const mins = (sec / 60).toFixed(1)
    return {
      tier: 'poor',
      label: '✗ Too slow',
      detail: `Slow throughput — expect ~${mins} min for a 5000-char article. Acceptable only if translation quality matters more than speed.`,
    }
  }

  // summary: long-prompt TTFT (prefill) と avg decode の AND 評価
  if (avgRate >= 200 && longTtftMs <= 2500) {
    return {
      tier: 'snappy',
      label: '✓ Snappy',
      detail: 'Instant summaries — sub-3s first response with real-time decode.',
    }
  }
  // 'good' 閾値は元々 100 ch/s だったが、Qwen 3 - 0.6B (108 ch/s) と
  // Qwen 3.5 - 0.8B (99.9 ch/s) のように体感同等のモデルが境界線で
  // 割れていたため 90 ch/s に下げた。実機検証ベース (iPhone 13 mini)。
  if (avgRate >= 90 && longTtftMs <= 6000) {
    return {
      tier: 'good',
      label: '✓ Practical',
      detail: `Comfortable tap-and-wait. ~${(longTtftMs / 1000).toFixed(1)}s to first word, decode at ~${Math.round(avgRate / 4)} tok/s.`,
    }
  }
  if (avgRate >= 50 || longTtftMs <= 15000) {
    return {
      tier: 'slow',
      label: '△ Usable but slow',
      detail: `Long articles take ${(longTtftMs / 1000).toFixed(1)}s+ to start. Consider a smaller model for snappier UX.`,
    }
  }
  return {
    tier: 'poor',
    label: '✗ Too slow',
    detail:
      'Too slow for practical daily use on this device. Try a smaller model.',
  }
}

// ---- Runner ----------------------------------------------------------------

// useLLM が公開する response (streaming string)、isGenerating、isReady を
// 監視して executorch backend の cold load / TTFT / decode を測る。
// llama.rn backend は ctx.completion の partial callback で直接測る。
export function useBenchmarkRunner() {
  const { llm, selectedModel, updateSettings, runWithLlamaRn } = useAi()
  const [phase, setPhase] = useState('idle') // idle | loading | running | done | error | cancelled
  const [progress, setProgress] = useState(null) // { promptIdx, total } | null
  const stateRef = useRef(null)
  // cancel フラグ。cancel() で立て、reset() で下ろす。runBenchmark の
  // 各ループ境界で参照して早期 break する (mid-generation の中断は
  // executorch のみ llm.interrupt() で可能、llama.rn は次プロンプトまで待つ)
  const cancelRef = useRef(false)

  // executorch: response 監視 (TTFT + char 数)
  useEffect(() => {
    const s = stateRef.current
    if (!s || !s.runActive) return
    const len = llm.response ? llm.response.length : 0
    if (s.firstTokenAt === null && len > 0) {
      s.firstTokenAt = now()
    }
    if (len > 0) s.lastLength = len
  }, [llm.response])

  // executorch: 生成完了検知
  useEffect(() => {
    const s = stateRef.current
    if (!s || !s.runActive) return
    if (llm.isGenerating) {
      s.sawGenerating = true
    } else if (s.sawGenerating) {
      s.runActive = false
      s.resolveRun && s.resolveRun()
    }
  }, [llm.isGenerating])

  // executorch: モデル ready 検知 (cold load 計測)
  useEffect(() => {
    const s = stateRef.current
    if (!s || !s.waitingForReady) return
    if (llm.isReady) {
      s.waitingForReady = false
      const ms = now() - s.coldLoadStart
      s.resolveColdLoad && s.resolveColdLoad(ms)
    }
  }, [llm.isReady])

  // executorch backend 用の benchmark
  const runExecutorchBenchmark = useCallback(
    async (targetModel) => {
      setPhase('loading')
      setProgress(null)

      let coldLoadMs = 0
      const needsSwap = selectedModel?.id !== targetModel.id
      const needsLoad = !llm.isReady

      if (needsSwap || needsLoad) {
        const coldPromise = new Promise((resolve) => {
          stateRef.current = {
            waitingForReady: true,
            coldLoadStart: now(),
            resolveColdLoad: resolve,
          }
        })
        await updateSettings({
          selectedModelId: targetModel.id,
          downloadEnabled: true,
        })
        coldLoadMs = await coldPromise
        stateRef.current = null
      }

      if (cancelRef.current) {
        setPhase('cancelled')
        setProgress(null)
        return {
          modelId: targetModel.id,
          coldLoadMs,
          prompts: [],
          runAt: Date.now(),
          cancelled: true,
        }
      }

      setPhase('running')
      const promptResults = []
      for (let i = 0; i < BENCHMARK_PROMPTS_SUMMARY.length; i++) {
        if (cancelRef.current) break
        setProgress({ promptIdx: i, total: BENCHMARK_PROMPTS_SUMMARY.length })
        const prompt = BENCHMARK_PROMPTS_SUMMARY[i]

        const runPromise = new Promise((resolve) => {
          stateRef.current = {
            runActive: true,
            sawGenerating: false,
            startedAt: now(),
            firstTokenAt: null,
            lastLength: 0,
            resolveRun: () => {
              const s = stateRef.current
              if (!s) return resolve(null)
              const ended = now()
              const ttftMs =
                s.firstTokenAt !== null
                  ? s.firstTokenAt - s.startedAt
                  : ended - s.startedAt
              const totalMs = ended - s.startedAt
              const decodeMs = Math.max(0, totalMs - ttftMs)
              const chars = s.lastLength
              resolve({
                promptId: prompt.id,
                label: prompt.label,
                ttftMs,
                totalMs,
                decodeMs,
                chars,
                charsPerSec: decodeMs > 0 ? chars / (decodeMs / 1000) : 0,
              })
            },
          }
        })

        try {
          llm.configure({ generationConfig: EXECUTORCH_GENERATION_CONFIG })
        } catch {
          /* configure 失敗は致命ではない */
        }

        llm
          .generate([{ role: 'user', content: prompt.text }])
          .catch((err) => {
            console.warn('[benchmark] generate failed:', err?.message ?? err)
            const s = stateRef.current
            if (s?.runActive) {
              s.runActive = false
              s.resolveRun && s.resolveRun()
            }
          })

        const result = await runPromise
        // cancel 中の interrupt() で抜けた部分結果は捨てる (TTFT/decode が
        // 信用できない数字になっているため)
        if (result && !cancelRef.current) promptResults.push(result)
        stateRef.current = null
      }

      const cancelled = cancelRef.current
      setPhase(cancelled ? 'cancelled' : 'done')
      setProgress(null)
      return {
        modelId: targetModel.id,
        coldLoadMs,
        prompts: promptResults,
        runAt: Date.now(),
        cancelled,
      }
    },
    [llm, selectedModel, updateSettings],
  )

  // llama.rn backend 用の benchmark。runWithLlamaRn の onSession 内で全
  // プロンプトを逐次実行し、ctx.completion の partial callback で TTFT を
  // 測る。
  const runLlamaRnBenchmark = useCallback(
    async (targetModel) => {
      setPhase('loading')
      setProgress(null)

      const overallStart = now()
      let coldLoadMs = 0
      const promptResults = []
      const llamaModel = targetModel.llamaModel ?? HY_MT2_TRANSLATION_MODEL
      const sampling = llamaModel.sampling ?? HY_MT2_SAMPLING

      try {
        await runWithLlamaRn({
          model: llamaModel,
          contextParams: { n_ctx: 4096 },
          onSession: async (ctx) => {
            // cold load は runWithLlamaRn 内部の 400ms swap + initLlama 込み
            coldLoadMs = now() - overallStart
            if (cancelRef.current) return
            setPhase('running')

            for (let i = 0; i < BENCHMARK_PROMPTS_TRANSLATION.length; i++) {
              if (cancelRef.current) break
              setProgress({
                promptIdx: i,
                total: BENCHMARK_PROMPTS_TRANSLATION.length,
              })
              const prompt = BENCHMARK_PROMPTS_TRANSLATION[i]
              const start = now()
              let firstTokenAt = null

              const completion = await ctx.completion(
                {
                  messages: [
                    { role: 'user', content: buildHyMt2PromptText(prompt.text) },
                  ],
                  // 入力長 ~ 出力長 を想定、固定上限。短すぎると途中で切れ
                  // て decode rate が過大評価される。
                  n_predict: 1024,
                  temperature: sampling.temperature,
                  top_p: sampling.top_p,
                  top_k: sampling.top_k,
                  penalty_repeat: sampling.penalty_repeat,
                  stop: ['</s>', '<|endoftext|>', '<end_of_turn>', '<|eos|>'],
                },
                () => {
                  if (firstTokenAt === null) firstTokenAt = now()
                },
              )
              const ended = now()
              const text = (completion?.text ?? completion?.content ?? '').trim()
              const ttftMs =
                firstTokenAt !== null ? firstTokenAt - start : ended - start
              const totalMs = ended - start
              const decodeMs = Math.max(0, totalMs - ttftMs)
              const chars = text.length

              // cancel 中に終わった prompt の結果も部分計測としては
              // 有効だが、次イテレーションの先頭 cancelRef チェックで抜ける
              promptResults.push({
                promptId: prompt.id,
                label: prompt.label,
                ttftMs,
                totalMs,
                decodeMs,
                chars,
                charsPerSec: decodeMs > 0 ? chars / (decodeMs / 1000) : 0,
              })
            }
            return promptResults
          },
        })
      } catch (err) {
        console.warn('[benchmark] llama.rn run failed:', err?.message ?? err)
      }

      const cancelled = cancelRef.current
      setPhase(cancelled ? 'cancelled' : 'done')
      setProgress(null)
      return {
        modelId: targetModel.id,
        coldLoadMs,
        prompts: promptResults,
        runAt: Date.now(),
        cancelled,
      }
    },
    [runWithLlamaRn],
  )

  const runBenchmark = useCallback(
    async (targetModel) => {
      if (!targetModel) return null
      try {
        if (targetModel.backend === 'llama.rn') {
          return await runLlamaRnBenchmark(targetModel)
        }
        return await runExecutorchBenchmark(targetModel)
      } catch (err) {
        console.warn('[benchmark] runBenchmark threw:', err?.message ?? err)
        stateRef.current = null
        setPhase('error')
        setProgress(null)
        return null
      }
    },
    [runExecutorchBenchmark, runLlamaRnBenchmark],
  )

  const reset = useCallback(() => {
    stateRef.current = null
    cancelRef.current = false
    setPhase('idle')
    setProgress(null)
  }, [])

  // 実行中の benchmark を中断する。executorch は in-flight generate を
  // llm.interrupt() で即座に止め、llama.rn は次プロンプトでループを抜ける
  // (mid-completion の中断 API は未公開)。
  const cancel = useCallback(() => {
    cancelRef.current = true
    try {
      if (llm?.isGenerating && typeof llm.interrupt === 'function') {
        llm.interrupt()
      }
    } catch (e) {
      console.warn('[benchmark] interrupt failed:', e?.message ?? e)
    }
  }, [llm])

  return { phase, progress, runBenchmark, reset, cancel }
}
