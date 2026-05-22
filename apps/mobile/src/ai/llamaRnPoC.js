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

export const POC_MODELS = [
  {
    id: 'gemma-4-E2B-it-Q4_K_M',
    displayName: 'Gemma 4 E2B-it Q4_K_M',
    url: 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_K_M.gguf',
    expectedBytes: 3_110_000_000, // ~3.11 GB
    note: 'Multimodal (Any-to-Any). PoC main target.',
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

// fixed prompt used for the load+run benchmark
const BENCH_MESSAGES = [
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
    const genStart = Date.now()
    const completion = await ctx.completion({
      messages: BENCH_MESSAGES,
      n_predict: 256,
      temperature: 0.7,
      top_p: 0.9,
      stop: ['</s>', '<|endoftext|>', '<end_of_turn>'],
    })
    const generateMs = Date.now() - genStart

    const text = completion?.text ?? completion?.content ?? ''
    const tokenCount =
      completion?.timings?.predicted_n ??
      completion?.tokens_predicted ??
      0
    const tokensPerSec =
      tokenCount > 0 && generateMs > 0 ? (tokenCount * 1000) / generateMs : 0

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
