// On-disk helpers for executorch model files (react-native-executorch 0.11
// new API).
//
// The new fetcher only exposes download(): there is no size / delete /
// "is it downloaded" API. cachePathFor() below mirrors the fetcher's private
// cachePathFor() (src/fetcher/fetcher.ts in 0.11.0) so we can stat and unlink
// the same files. Re-check it when bumping react-native-executorch.

import { Platform } from 'react-native'
import RNBlobUtil from 'react-native-blob-util'

const RNE_DIRECTORY =
  Platform.OS === 'android'
    ? `${RNBlobUtil.fs.dirs.SDCardDir || RNBlobUtil.fs.dirs.DocumentDir}/react-native-executorch`
    : `${RNBlobUtil.fs.dirs.DocumentDir}/react-native-executorch`

// djb2, byte-for-byte the same as the fetcher's (including the XOR variant).
function djb2(s) {
  let h = 5381
  for (let i = 0; i < s.length; i += 1) {
    // eslint-disable-next-line no-bitwise
    h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0
  }
  return h
}

export function cachePathFor(url) {
  const urlWithoutQuery = url.split('?')[0]
  const basename = urlWithoutQuery.split('/').pop() || 'model'
  return `${RNE_DIRECTORY}/${djb2(urlWithoutQuery)}_${basename}`
}

export function modelUrls(executorchModel) {
  if (!executorchModel) return []
  const { modelPath, tokenizerPath, tokenizerConfigPath } = executorchModel
  return [modelPath, tokenizerPath, tokenizerConfigPath].filter(Boolean)
}

async function fileSize(path) {
  try {
    const stat = await RNBlobUtil.fs.stat(path)
    return Number(stat.size) || 0
  } catch {
    return 0
  }
}

// Total bytes on disk for the model, or 0 unless every file is present
// (a half-downloaded model is not usable, so don't report a size for it).
export async function getDownloadedBytes(executorchModel) {
  const sizes = await Promise.all(modelUrls(executorchModel).map((u) => fileSize(cachePathFor(u))))
  if (sizes.length === 0 || sizes.some((s) => s === 0)) return 0
  return sizes.reduce((a, b) => a + b, 0)
}

// Deletes the model's files plus any partial-download leftovers. URLs in
// `keepUrls` are skipped: models of one family share tokenizer files (e.g.
// Qwen3 0.6B / 1.7B), so deleting one must not break the other.
export async function deleteModelFiles(executorchModel, keepUrls = []) {
  const keep = new Set(keepUrls)
  const targets = modelUrls(executorchModel).filter((u) => !keep.has(u))
  await Promise.all(
    targets.flatMap((u) => {
      const dest = cachePathFor(u)
      return [dest, `${dest}.partial`, `${dest}.chunk`].map((p) =>
        RNBlobUtil.fs.unlink(p).catch(() => {}),
      )
    }),
  )
}

// Removes files written by the 0.9 / legacy resource fetcher
// (react-native-executorch-expo-resource-fetcher). It stored URL-derived
// names ("huggingface.co_software-mansion_...") in
// <documentDirectory>/react-native-executorch/; the new fetcher prefixes every
// file with "<djb2>_". On iOS both share the directory, so only
// non-prefixed entries are removed. Returns the number of entries deleted.
export async function removeLegacyModelFiles() {
  // expo-file-system's documentDirectory and RNBlobUtil's DocumentDir are the
  // same app Documents dir (Android: internal files dir).
  const legacyDir = `${RNBlobUtil.fs.dirs.DocumentDir}/react-native-executorch`
  let entries
  try {
    entries = await RNBlobUtil.fs.ls(legacyDir)
  } catch (e) {
    console.log(`[ai] legacy model dir not readable (${legacyDir}): ${e?.message ?? e}`)
    return 0
  }
  const legacy = entries.filter((name) => !/^\d+_/.test(name))
  await Promise.all(
    legacy.map((name) => RNBlobUtil.fs.unlink(`${legacyDir}/${name}`).catch(() => {})),
  )
  return legacy.length
}
