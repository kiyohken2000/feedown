import AsyncStorage from '@react-native-async-storage/async-storage'
import { AI_KEYS, getCacheRecord, saveCacheRecord, deleteCacheRecord } from './aiStorage'
import { MODEL_DEFINITION_VERSION } from './models'
import { normalizeSignalsShape } from './jsonOutput'

function buildSummaryCacheKey(articleId, contentHash, modelId, perspective, outputLanguage) {
  return `${articleId}:${contentHash}:${modelId}:${perspective}:${outputLanguage}`
}

function buildSignalsCacheKey(articleId, contentHash, modelId, outputLanguage) {
  return `${articleId}:${contentHash}:${modelId}:signals:${outputLanguage}`
}

function makeRecord(base) {
  return {
    cacheVersion: 1,
    modelDefinitionVersion: MODEL_DEFINITION_VERSION,
    createdAt: new Date().toISOString(),
    ...base,
  }
}

/** AI results are kept for 7 days (BRUSHUP #14), then generated again. */
export const AI_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * True when the record is older than the TTL. Records without a readable
 * `createdAt` count as expired: it is only a cache.
 */
export function isExpired(record, now = Date.now()) {
  const created = Date.parse(record?.createdAt)
  if (Number.isNaN(created)) return true
  return now - created > AI_CACHE_TTL_MS
}

/** Read a record, dropping it when it has expired. */
async function getLiveRecord(prefix, key) {
  const record = await getCacheRecord(prefix, key)
  if (!record) return null
  if (isExpired(record)) {
    await deleteCacheRecord(prefix, key)
    return null
  }
  return record
}

function isRecordValid(record, contentHash) {
  if (!record) return false
  if (record.modelDefinitionVersion !== MODEL_DEFINITION_VERSION) return false
  if (record.contentHash !== contentHash) return false
  return true
}

export async function getSummaryCache(articleId, contentHash, modelId, perspective, outputLanguage) {
  const key = buildSummaryCacheKey(articleId, contentHash, modelId, perspective, outputLanguage)
  const record = await getLiveRecord(AI_KEYS.SUMMARY_PREFIX, key)
  if (!isRecordValid(record, contentHash)) return null
  return record.result
}

export async function saveSummaryCache(articleId, contentHash, modelId, perspective, outputLanguage, result) {
  const key = buildSummaryCacheKey(articleId, contentHash, modelId, perspective, outputLanguage)
  await saveCacheRecord(
    AI_KEYS.SUMMARY_PREFIX,
    key,
    makeRecord({ articleId, contentHash, modelId, perspective, outputLanguage, result }),
  )
}

export async function getSignalsCache(articleId, contentHash, modelId, outputLanguage) {
  const key = buildSignalsCacheKey(articleId, contentHash, modelId, outputLanguage)
  const record = await getLiveRecord(AI_KEYS.SUMMARY_PREFIX, key)
  if (!isRecordValid(record, contentHash)) return null
  // Migrate legacy {signals:[{type,text,confidence}]} cache entries to the
  // new {facts, claims, quotes} shape on read so existing caches keep working.
  const normalized = normalizeSignalsShape(record.result)
  return normalized ?? record.result
}

export async function saveSignalsCache(articleId, contentHash, modelId, outputLanguage, result) {
  const key = buildSignalsCacheKey(articleId, contentHash, modelId, outputLanguage)
  await saveCacheRecord(
    AI_KEYS.SUMMARY_PREFIX,
    key,
    makeRecord({ articleId, contentHash, modelId, outputLanguage, result }),
  )
}

function buildTranslationCacheKey(articleId, readerHash, modelId, targetLanguage) {
  return `${articleId}:${readerHash}:${modelId}:${targetLanguage}`
}

export async function getTranslationCache(articleId, readerHash, modelId, targetLanguage) {
  const key = buildTranslationCacheKey(articleId, readerHash, modelId, targetLanguage)
  const record = await getLiveRecord(AI_KEYS.TRANSLATION_PREFIX, key)
  if (!record) return null
  if (record.modelDefinitionVersion !== MODEL_DEFINITION_VERSION) return null
  if (record.readerHash !== readerHash) return null
  return record.result
}

export async function saveTranslationCache(articleId, readerHash, modelId, targetLanguage, result) {
  const key = buildTranslationCacheKey(articleId, readerHash, modelId, targetLanguage)
  await saveCacheRecord(
    AI_KEYS.TRANSLATION_PREFIX,
    key,
    makeRecord({ articleId, readerHash, modelId, targetLanguage, result }),
  )
}

export async function deleteTranslationCache(articleId, readerHash, modelId, targetLanguage) {
  const key = buildTranslationCacheKey(articleId, readerHash, modelId, targetLanguage)
  await deleteCacheRecord(AI_KEYS.TRANSLATION_PREFIX, key)
}

/**
 * Delete expired or unreadable summary / signals / translation records.
 * Run once at startup. Never throws.
 *
 * @returns {Promise<number>} how many records were deleted
 */
export async function sweepExpiredAiCache(now = Date.now()) {
  try {
    const prefixes = [AI_KEYS.SUMMARY_PREFIX, AI_KEYS.TRANSLATION_PREFIX]
    const keys = (await AsyncStorage.getAllKeys()).filter((k) =>
      prefixes.some((p) => k.startsWith(p))
    )
    if (keys.length === 0) return 0
    const entries = await AsyncStorage.multiGet(keys)
    const expired = entries
      .filter(([, raw]) => {
        try {
          return isExpired(JSON.parse(raw), now)
        } catch {
          return true
        }
      })
      .map(([key]) => key)
    if (expired.length > 0) await AsyncStorage.multiRemove(expired)
    return expired.length
  } catch (e) {
    console.warn(`[ai] cache sweep failed: ${e?.message || e}`)
    return 0
  }
}
