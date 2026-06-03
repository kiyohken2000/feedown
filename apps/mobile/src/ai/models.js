import {
  LFM2_5_1_2B_INSTRUCT_QUANTIZED,
  LFM2_5_350M_QUANTIZED,
  QWEN3_0_6B_QUANTIZED,
  QWEN3_1_7B_QUANTIZED,
  QWEN3_5_0_8B_QUANTIZED,
  QWEN3_5_2B_QUANTIZED,
} from 'react-native-executorch'

export const FEEDOWN_DEFAULT_LLM_ID = 'lfm2_5_1_2b_instruct_quantized'
export const MODEL_DEFINITION_VERSION = '1'

export const DEFAULT_MAX_INPUT_CHARS = 4000

// Per-feature sampling lives in useArticleAi.js (STRUCTURED_GENERATION_CONFIG
// for summary/signals, CHAT_GENERATION_CONFIG for chat) and is applied via
// llm.configure() before each generate. Putting generationConfig on the model
// constants here would be dead code — useArticleAi.configure() overrides it.

export const FEEDOWN_LLM_MODELS = [
  {
    id: 'lfm2_5_1_2b_instruct_quantized',
    executorchModel: LFM2_5_1_2B_INSTRUCT_QUANTIZED,
    displayName: 'LFM 2.5 - 1.2B Instruct',
    recommendation: 'recommended',
    features: ['summary'],
    notes: 'Balanced quality and performance.',
    maxInputChars: 5000,
  },
  {
    id: 'qwen3_0_6b_quantized',
    executorchModel: QWEN3_0_6B_QUANTIZED,
    displayName: 'Qwen 3 - 0.6B',
    recommendation: 'candidate',
    features: ['summary'],
    notes: 'Lightweight. Good starting point for testing.',
    maxInputChars: 4000,
  },
  {
    id: 'qwen3_1_7b_quantized',
    executorchModel: QWEN3_1_7B_QUANTIZED,
    displayName: 'Qwen 3 - 1.7B',
    recommendation: 'candidate',
    features: ['summary'],
    notes: 'Higher quality, higher memory usage.',
    maxInputChars: 5000,
  },
  {
    id: 'qwen3_5_0_8b_quantized',
    executorchModel: QWEN3_5_0_8B_QUANTIZED,
    displayName: 'Qwen 3.5 - 0.8B',
    recommendation: 'candidate',
    features: ['summary'],
    notes: 'Newer Qwen generation. Better instruction following at small size.',
    maxInputChars: 4500,
  },
  {
    id: 'qwen3_5_2b_quantized',
    executorchModel: QWEN3_5_2B_QUANTIZED,
    displayName: 'Qwen 3.5 - 2B',
    recommendation: 'candidate',
    features: ['summary'],
    notes: 'Newer Qwen generation. Highest quality option, more memory.',
    maxInputChars: 5500,
  },
  {
    id: 'lfm2_5_350m_quantized',
    executorchModel: LFM2_5_350M_QUANTIZED,
    displayName: 'LFM 2.5 - 350M',
    recommendation: 'fallback',
    features: ['summary'],
    notes: 'For low-memory devices.',
    maxInputChars: 3000,
  },
]

export function getModelById(id) {
  return FEEDOWN_LLM_MODELS.find((m) => m.id === id) ?? null
}
