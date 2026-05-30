// Model download / verify / delete helpers for llama.rn GGUF files.
//
// Resumable download via expo-file-system, atomic rename on success, GGUF
// magic-byte integrity check. Files live in <documentDirectory>/llama-models/.

import * as FileSystem from 'expo-file-system/legacy'

const MODELS_DIR = `${FileSystem.documentDirectory}llama-models/`

export function modelPathFor(model) {
  return `${MODELS_DIR}${model.id}.gguf`
}

async function ensureModelsDir() {
  const info = await FileSystem.getInfoAsync(MODELS_DIR)
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MODELS_DIR, { intermediates: true })
  }
}

export async function getModelStatus(model) {
  const info = await FileSystem.getInfoAsync(modelPathFor(model))
  if (!info.exists) return { downloaded: false, bytes: 0 }
  return { downloaded: true, bytes: info.size ?? 0 }
}

// Reads the first 4 bytes and checks GGUF magic = "GGUF" (0x47 0x47 0x55 0x46).
// Catches partial downloads and corrupted files without doing a full hash.
export async function verifyModelIntegrity(model) {
  const path = modelPathFor(model)
  const info = await FileSystem.getInfoAsync(path)
  if (!info.exists) return { ok: false, reason: 'File does not exist' }
  const bytes = info.size ?? 0
  let magic = ''
  try {
    const head = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: 4,
    })
    magic = atob(head).slice(0, 4)
  } catch (e) {
    return { ok: false, bytes, reason: `Read failed: ${e?.message ?? e}` }
  }
  const magicOk = magic === 'GGUF'
  return {
    ok: magicOk,
    bytes,
    magic,
    expectedBytes: model.expectedBytes,
    reason: magicOk ? 'GGUF magic OK' : `Bad magic: "${magic}"`,
  }
}

// progressCb: ({ totalBytesWritten, totalBytesExpectedToWrite, percent }) => void
export async function downloadModel(model, progressCb) {
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

export async function deleteModel(model) {
  const path = modelPathFor(model)
  const info = await FileSystem.getInfoAsync(path)
  if (!info.exists) return { deleted: false }
  await FileSystem.deleteAsync(path, { idempotent: true })
  return { deleted: true }
}

// llama.cpp wants a raw filesystem path, not a file:// URI.
export function toNativePath(uri) {
  if (!uri) return uri
  if (uri.startsWith('file://')) return uri.replace(/^file:\/\//, '')
  return uri
}
