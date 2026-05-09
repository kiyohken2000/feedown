import { AI_KEYS, getCacheRecord, saveCacheRecord, deleteCacheRecord } from './aiStorage'
import { MODEL_DEFINITION_VERSION } from './models'

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

function isRecordValid(record, contentHash) {
  if (!record) return false
  if (record.modelDefinitionVersion !== MODEL_DEFINITION_VERSION) return false
  if (record.contentHash !== contentHash) return false
  return true
}

export async function getSummaryCache(articleId, contentHash, modelId, perspective, outputLanguage) {
  const key = buildSummaryCacheKey(articleId, contentHash, modelId, perspective, outputLanguage)
  const record = await getCacheRecord(AI_KEYS.SUMMARY_PREFIX, key)
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
  const record = await getCacheRecord(AI_KEYS.SUMMARY_PREFIX, key)
  if (!isRecordValid(record, contentHash)) return null
  return record.result
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
  const record = await getCacheRecord(AI_KEYS.TRANSLATION_PREFIX, key)
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
