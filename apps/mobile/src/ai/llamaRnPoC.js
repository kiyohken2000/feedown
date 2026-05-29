// PoC: llama.rn + Gemma 4 E2B Q4_K_M
// Self-contained. Does NOT touch existing react-native-executorch / AiContext flow.
// Remove this file (and the Profile.js card that calls it) once the PoC verdict is made.

import * as FileSystem from 'expo-file-system/legacy'
import {
  initLlama,
  releaseAllLlama,
  toggleNativeLog,
  addNativeLogListener,
  loadLlamaModelInfo,
  getBackendDevicesInfo,
} from 'llama.rn'

// Enable verbose llama.cpp logging + pipe to JS console.
// Idempotent — safe to call multiple times.
let _nativeLogInstalled = false
let _nativeLogSub = null
export async function enableNativeLog() {
  if (_nativeLogInstalled) return
  try {
    await toggleNativeLog(true)
    _nativeLogSub = addNativeLogListener((level, text) => {
      const tag = `[llama.cpp:${level}]`
      if (level === 'error' || level === 'warn') {
        console.warn(tag, text)
      } else {
        console.log(tag, text)
      }
    })
    _nativeLogInstalled = true
    console.log('[llamaRnPoC] native log enabled')
  } catch (e) {
    console.error('[llamaRnPoC] enableNativeLog failed:', e?.message ?? e)
  }
}

export async function disableNativeLog() {
  try {
    if (_nativeLogSub) _nativeLogSub.remove?.()
    _nativeLogSub = null
    await toggleNativeLog(false)
    _nativeLogInstalled = false
  } catch (_e) {
    // best-effort
  }
}

// Probe model file with the lightweight metadata reader.
// If this succeeds but initLlama fails, the issue is context init not file parsing.
export async function probeModelInfo(model = POC_MODEL) {
  const nativePath = toNativePath(modelPathFor(model))
  try {
    const info = await loadLlamaModelInfo(nativePath)
    return { ok: true, info }
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e) }
  }
}

export async function probeBackends() {
  try {
    const info = await getBackendDevicesInfo()
    return { ok: true, info }
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e) }
  }
}

// --- Translation bench (Hy-MT2) -------------------------------------------
// Realistic multi-paragraph EN article (~1.1k chars), mirrors the real
// translation chunk size (limitParagraphsForTranslation caps at 2500 chars).
// Exported so the executorch comparison card translates the IDENTICAL source.
export const BENCH_TRANSLATE_SOURCE = `Apple unveiled iOS 27 today at its annual developer conference, headlining a wave of on-device artificial intelligence features that run entirely on the iPhone without sending data to the cloud. The company says the new models can summarize long articles, draft replies, and translate text between dozens of languages even when the device is offline.

Battery life also sees a significant upgrade. Apple claims the redesigned power management system extends typical usage by up to two hours on the latest hardware, thanks to a more efficient neural engine and smarter background task scheduling.

The update introduces a redesigned lock screen with interactive widgets that can display live information from third-party apps. Developers gain access to the new APIs starting today, while the public release is scheduled for this fall. Analysts note that the heavy emphasis on local processing reflects growing consumer concern over privacy and the rising cost of cloud inference.`

// Same source split into paragraphs — feeds the app's real buildTranslationMessages().
export const BENCH_TRANSLATE_PARAGRAPHS = BENCH_TRANSLATE_SOURCE.split('\n\n')

// Hy-MT2 official prompt template for non-Chinese pairs (EN->JA): single user
// turn, no system prompt, literal markdown bolding kept to match training.
// Source: tencent/Hy-MT2-1.8B model card.
export const BENCH_TRANSLATE_MESSAGES = [
  {
    role: 'user',
    content: `Translate the following text into Japanese. Note that you should **only output the translated result without any additional explanation**:\n\n${BENCH_TRANSLATE_SOURCE}`,
  },
]

// Sampling recommended by the Hy-MT2 model card.
const HY_MT2_SAMPLING = {
  n_predict: 512,
  temperature: 0.7,
  top_p: 0.6,
  top_k: 20,
  penalty_repeat: 1.05,
}

export const POC_MODELS = [
  {
    id: 'Hy-MT2-1.8B-Q4_K_M',
    displayName: 'Hy-MT2 1.8B Q4_K_M (translation)',
    url: 'https://huggingface.co/tencent/Hy-MT2-1.8B-GGUF/resolve/main/Hy-MT2-1.8B-Q4_K_M.gguf',
    expectedBytes: 1_133_000_000, // ~1.13 GB
    note: 'Tencent translation-specialized. EN->JA bench. Fits A15/4GB with room to spare.',
    benchMessages: BENCH_TRANSLATE_MESSAGES,
    benchSampling: HY_MT2_SAMPLING,
  },
  {
    id: 'Hy-MT2-1.8B-Q6_K',
    displayName: 'Hy-MT2 1.8B Q6_K (translation)',
    url: 'https://huggingface.co/tencent/Hy-MT2-1.8B-GGUF/resolve/main/Hy-MT2-1.8B-Q6_K.gguf',
    expectedBytes: 1_475_000_000, // ~1.47 GB
    note: 'Standard Q6_K. Higher-quality fallback if Q4_K_M quality is borderline.',
    benchMessages: BENCH_TRANSLATE_MESSAGES,
    benchSampling: HY_MT2_SAMPLING,
  },
  // NOTE: AngelSlim 2-bit / 1.25-bit GGUFs do NOT load in llama.rn 0.12.4's
  // bundled llama.cpp — they use a custom ultra-low-bit quant format that fails
  // GGUF parsing ("tensor blk.0.attn_k_norm.weight has offset X, expected Y").
  // Only the standard tencent quants (Q4_K_M / Q6_K / Q8_0) are usable here.
  {
    id: 'gemma-4-E2B-it-Q4_K_M',
    displayName: 'Gemma 4 E2B-it Q4_K_M',
    url: 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_K_M.gguf',
    expectedBytes: 3_110_000_000, // ~3.11 GB
    note: 'Multimodal. OOM on iPhone 13 mini (A15/4GB): weights 2948MB > 2863MB working set.',
  },
  {
    id: 'gemma-4-E2B-it-Q3_K_M',
    displayName: 'Gemma 4 E2B-it Q3_K_M',
    url: 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q3_K_M.gguf',
    expectedBytes: 2_540_000_000, // ~2.54 GB
    note: 'Smaller quant. Testing if it fits the A15 working set where Q4_K_M OOMs.',
  },
  {
    id: 'gemma-4-E2B-it-UD-Q2_K_XL',
    displayName: 'Gemma 4 E2B-it UD-Q2_K_XL',
    url: 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-UD-Q2_K_XL.gguf',
    expectedBytes: 2_400_000_000, // ~2.40 GB
    note: 'Unsloth Dynamic 2-bit. Most headroom; fallback if Q3_K_M still OOMs.',
  },
  {
    id: 'Qwen3-0.6B-Q4_K_M',
    displayName: 'Qwen3 0.6B Q4_K_M (sanity test)',
    url: 'https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_K_M.gguf',
    expectedBytes: 460_000_000, // ~460 MB
    note: 'Text-only, known-good. If this loads but Gemma 4 doesnt, Gemma 4 is the problem.',
  },
]

// Back-compat: keep POC_MODEL as the default (Gemma 4) so older imports still work.
export const POC_MODEL = POC_MODELS[0]

const MODELS_DIR = `${FileSystem.documentDirectory}llama-models/`
const modelPathFor = (model) => `${MODELS_DIR}${model.id}.gguf`

// fixed prompt used for the load+run benchmark (exported so the executorch
// comparison card runs the identical prompt for an apples-to-apples tok/s)
export const BENCH_MESSAGES = [
  {
    role: 'system',
    content:
      'あなたは RSS 記事の要約アシスタントです。入力された記事を 2 文で日本語要約してください。',
  },
  {
    role: 'user',
    content:
      '記事タイトル: Apple、iOS 27 を発表\n本文: Apple は本日、新しい iOS 27 を発表した。オンデバイス AI 機能の強化、バッテリー寿命の改善、新しいロック画面ウィジェットが含まれる。開発者向けベータは本日から、一般リリースは秋を予定している。',
  },
]

async function ensureModelsDir() {
  const info = await FileSystem.getInfoAsync(MODELS_DIR)
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MODELS_DIR, { intermediates: true })
  }
}

export async function getModelStatus(model = POC_MODEL) {
  const info = await FileSystem.getInfoAsync(modelPathFor(model))
  if (!info.exists) return { downloaded: false, bytes: 0 }
  return { downloaded: true, bytes: info.size ?? 0 }
}

// Read first 4 bytes and check GGUF magic = "GGUF" (0x47 0x47 0x55 0x46).
export async function verifyModelIntegrity(model = POC_MODEL) {
  const path = modelPathFor(model)
  const info = await FileSystem.getInfoAsync(path)
  if (!info.exists) return { ok: false, reason: 'File does not exist' }
  const bytes = info.size ?? 0
  let head = ''
  let magic = ''
  let magicOk = false
  try {
    head = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: 4,
    })
    magic = atob(head).slice(0, 4)
    magicOk = magic === 'GGUF'
  } catch (e) {
    return { ok: false, bytes, reason: `Read failed: ${e?.message ?? e}` }
  }
  return {
    ok: magicOk,
    bytes,
    magic,
    expectedBytes: model.expectedBytes,
    reason: magicOk ? 'GGUF magic OK' : `Bad magic: "${magic}"`,
  }
}

// progressCb: ({ totalBytesWritten, totalBytesExpectedToWrite, percent }) => void
export async function downloadModel(progressCb, model = POC_MODEL) {
  await ensureModelsDir()
  const path = modelPathFor(model)
  const existing = await getModelStatus(model)
  if (existing.downloaded) return { ok: true, alreadyExisted: true, path }

  const tmpPath = `${path}.partial`
  const resumable = FileSystem.createDownloadResumable(
    model.url,
    tmpPath,
    {},
    (p) => {
      if (!progressCb) return
      const total = p.totalBytesExpectedToWrite || model.expectedBytes
      const percent = total > 0 ? p.totalBytesWritten / total : 0
      progressCb({
        totalBytesWritten: p.totalBytesWritten,
        totalBytesExpectedToWrite: total,
        percent,
      })
    },
  )

  const startedAt = Date.now()
  const result = await resumable.downloadAsync()
  if (!result) throw new Error('Download cancelled or failed (no result)')
  await FileSystem.moveAsync({ from: result.uri, to: path })
  const elapsedMs = Date.now() - startedAt
  const info = await FileSystem.getInfoAsync(path)
  return {
    ok: true,
    alreadyExisted: false,
    path,
    bytes: info.size ?? 0,
    elapsedMs,
  }
}

export async function deleteModel(model = POC_MODEL) {
  const path = modelPathFor(model)
  const info = await FileSystem.getInfoAsync(path)
  if (!info.exists) return { deleted: false }
  await FileSystem.deleteAsync(path, { idempotent: true })
  return { deleted: true }
}

// Strip file:// prefix — llama.cpp wants a raw filesystem path.
function toNativePath(uri) {
  if (!uri) return uri
  if (uri.startsWith('file://')) return uri.replace(/^file:\/\//, '')
  return uri
}

function toFileUri(p) {
  if (!p) return p
  if (p.startsWith('file://')) return p
  return `file://${p}`
}

// Diagnostic: report whether the native module is actually loaded
export function diagNativeModule() {
  const initType = typeof initLlama
  const releaseType = typeof releaseAllLlama
  return {
    initLlamaType: initType,
    releaseAllLlamaType: releaseType,
    initLlamaName: initLlama?.name,
    loaded: initType === 'function',
  }
}

// One-shot benchmark: init context → completion → release
// Returns { loadMs, generateMs, tokensPerSec, text, tokenCount, gpuLayersUsed }
// opts: { nGpuLayers?: number, model?: object }   default model = POC_MODEL (Gemma 4)
export async function runBenchmark(opts = {}) {
  const model = opts.model ?? POC_MODEL
  const status = await getModelStatus(model)
  if (!status.downloaded) throw new Error('Model not downloaded yet')
  // sanity: require at least 50% of expected size
  const minBytes = Math.floor(model.expectedBytes * 0.5)
  if (status.bytes < minBytes) {
    throw new Error(
      `Model file looks truncated (${status.bytes} bytes, expected ~${model.expectedBytes}). Re-download recommended.`,
    )
  }

  // Diagnostic: confirm native module is loaded + turn on llama.cpp internal logging
  const diag = diagNativeModule()
  console.log('[llamaRnPoC] diagNativeModule:', JSON.stringify(diag))
  if (!diag.loaded) {
    throw new Error(
      `llama.rn native module NOT loaded. initLlama is ${diag.initLlamaType}. Dev client likely missing the binary — rebuild required.`,
    )
  }
  await enableNativeLog()

  // Probe backend devices and model metadata first — these give detailed errors.
  const backends = await probeBackends()
  console.log('[llamaRnPoC] backends:', JSON.stringify(backends))

  const probe = await probeModelInfo(model)
  console.log('[llamaRnPoC] probeModelInfo:', JSON.stringify(probe).slice(0, 500))

  const rawPath = modelPathFor(model)
  const nativePath = toNativePath(rawPath)
  const fileUri = toFileUri(rawPath)
  const requestedGpuLayers = typeof opts.nGpuLayers === 'number' ? opts.nGpuLayers : 99

  // Try 4 combinations: (raw path + GPU), (raw + CPU), (file:// + GPU), (file:// + CPU)
  const attempts = [
    { label: 'raw+GPU', path: nativePath, nGpu: requestedGpuLayers },
    { label: 'raw+CPU', path: nativePath, nGpu: 0 },
    { label: 'fileUri+GPU', path: fileUri, nGpu: requestedGpuLayers },
    { label: 'fileUri+CPU', path: fileUri, nGpu: 0 },
  ]

  let ctx = null
  let gpuLayersUsed = null
  let loadMs = 0
  const errors = []

  for (const a of attempts) {
    const t0 = Date.now()
    try {
      console.log('[llamaRnPoC] try:', a.label, 'path=', a.path)
      ctx = await initLlama({
        model: a.path,
        n_ctx: 2048,
        n_gpu_layers: a.nGpu,
      })
      gpuLayersUsed = a.nGpu
      loadMs = Date.now() - t0
      console.log('[llamaRnPoC] OK:', a.label, 'loadMs=', loadMs)
      break
    } catch (err) {
      const m = err?.message ?? String(err)
      console.warn('[llamaRnPoC] FAIL:', a.label, m)
      errors.push(`${a.label}: ${m}`)
    }
  }

  if (!ctx) {
    throw new Error(
      `initLlama failed across all 4 attempts:\n${errors.join('\n')}\nrawPath=${rawPath}`,
    )
  }

  try {
    const messages = opts.messages ?? model.benchMessages ?? BENCH_MESSAGES
    const s = model.benchSampling ?? { n_predict: 256, temperature: 0.7, top_p: 0.9 }
    const genStart = Date.now()
    const completion = await ctx.completion({
      messages,
      n_predict: s.n_predict ?? 256,
      temperature: s.temperature ?? 0.7,
      top_p: s.top_p ?? 0.9,
      ...(s.top_k != null ? { top_k: s.top_k } : {}),
      ...(s.penalty_repeat != null ? { penalty_repeat: s.penalty_repeat } : {}),
      stop: ['</s>', '<|endoftext|>', '<end_of_turn>', '<|eos|>'],
    })
    const generateMs = Date.now() - genStart

    const text = completion?.text ?? completion?.content ?? ''
    const tokenCount =
      completion?.timings?.predicted_n ??
      completion?.tokens_predicted ??
      0
    const tokensPerSec =
      tokenCount > 0 && generateMs > 0 ? (tokenCount * 1000) / generateMs : 0

    console.log(
      `[llamaRnPoC] ===== OUTPUT (${model.displayName}, ${tokensPerSec.toFixed(1)} tok/s, loadMs=${loadMs}) =====\n${text}\n[llamaRnPoC] ===== END =====`,
    )

    return {
      ok: true,
      loadMs,
      generateMs,
      tokensPerSec,
      text,
      tokenCount,
      gpuLayersUsed,
      raw: completion,
    }
  } finally {
    try {
      await ctx.release()
    } catch (_e) {
      // best-effort cleanup
    }
  }
}

export async function releaseAll() {
  try {
    await releaseAllLlama()
  } catch (_e) {
    // best-effort
  }
}

export const POC_PATHS = { MODELS_DIR, modelPathFor }
