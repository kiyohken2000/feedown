import AsyncStorage from '@react-native-async-storage/async-storage'

export const AI_KEYS = {
  SETTINGS: 'feedown:ai:settings',
  SUMMARY_PREFIX: 'feedown:ai:summary:',
  TRANSLATION_PREFIX: 'feedown:ai:translation:',
}

export const DEFAULT_AI_SETTINGS = {
  enabled: false,
  selectedModelId: 'lfm2_5_1_2b_instruct_quantized',
  // user must explicitly press "Download" before the model loads
  downloadEnabled: false,
  // model IDs that have been successfully downloaded to this device
  downloadedModelIds: [],
  // language for AI-generated output ('ja' | 'en' | 'ko' | 'zh')
  outputLanguage: 'ja',
  // TTS settings
  ttsEnabled: false,
  ttsDownloadEnabled: false,
  ttsVoiceId: 'af_heart',
  ttsDownloadedVoiceIds: [],
  // Translation engine: 'lfm' = executorch LFM2.5 (default, current behavior)
  // 'hy-mt2' = llama.rn Hy-MT2 1.8B Q4_K_M (opt-in, requires 1.13GB DL).
  // Default OFF for graceful upgrade — existing users keep their current
  // translation behavior until they explicitly opt in.
  translationEngine: 'lfm',
  // True once the Hy-MT2 GGUF has finished downloading on this device.
  hyMt2Downloaded: false,
}

export const TTS_VOICE_OPTIONS = [
  { id: 'af_heart',   label: 'Heart (F)',   accent: 'US English' },
  { id: 'af_river',   label: 'River (F)',   accent: 'US English' },
  { id: 'af_sarah',   label: 'Sarah (F)',   accent: 'US English' },
  { id: 'am_adam',    label: 'Adam (M)',    accent: 'US English' },
  { id: 'am_michael', label: 'Michael (M)', accent: 'US English' },
  { id: 'bf_emma',    label: 'Emma (F)',    accent: 'UK English' },
  { id: 'bm_daniel',  label: 'Daniel (M)', accent: 'UK English' },
]

export const OUTPUT_LANGUAGES = [
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語' },
  { code: 'en', label: 'English',  nativeLabel: 'English' },
  { code: 'ko', label: 'Korean',   nativeLabel: '한국어' },
  { code: 'zh', label: 'Chinese',  nativeLabel: '中文' },
]

export async function getAiSettings() {
  try {
    const raw = await AsyncStorage.getItem(AI_KEYS.SETTINGS)
    if (!raw) return { ...DEFAULT_AI_SETTINGS }
    return { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_AI_SETTINGS }
  }
}

export async function saveAiSettings(settings) {
  await AsyncStorage.setItem(AI_KEYS.SETTINGS, JSON.stringify(settings))
}

export async function getCacheRecord(prefix, cacheKey) {
  try {
    const raw = await AsyncStorage.getItem(prefix + cacheKey)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function saveCacheRecord(prefix, cacheKey, record) {
  try {
    await AsyncStorage.setItem(prefix + cacheKey, JSON.stringify(record))
  } catch {
    // AsyncStorage の容量制限など。無視してキャッシュなしで続行
  }
}

export async function deleteCacheRecord(prefix, cacheKey) {
  try {
    await AsyncStorage.removeItem(prefix + cacheKey)
  } catch {
    // ignore
  }
}
