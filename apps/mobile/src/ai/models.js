import {
  LFM2_5_1_2B_INSTRUCT_QUANTIZED,
  LFM2_5_350M_QUANTIZED,
  QWEN3_0_6B_QUANTIZED,
  QWEN3_1_7B_QUANTIZED,
} from 'react-native-executorch'

export const FEEDOWN_DEFAULT_LLM_ID = 'lfm2_5_1_2b_instruct_quantized'
export const MODEL_DEFINITION_VERSION = '1'

export const FEEDOWN_LLM_MODELS = [
  {
    id: 'lfm2_5_1_2b_instruct_quantized',
    executorchModel: LFM2_5_1_2B_INSTRUCT_QUANTIZED,
    displayName: 'LFM 2.5 - 1.2B Instruct',
    recommendation: 'recommended',
    features: ['summary'],
    notes: 'Balanced quality and performance.',
  },
  {
    id: 'qwen3_0_6b_quantized',
    executorchModel: QWEN3_0_6B_QUANTIZED,
    displayName: 'Qwen 3 - 0.6B',
    recommendation: 'candidate',
    features: ['summary'],
    notes: 'Lightweight. Good starting point for testing.',
  },
  {
    id: 'qwen3_1_7b_quantized',
    executorchModel: QWEN3_1_7B_QUANTIZED,
    displayName: 'Qwen 3 - 1.7B',
    recommendation: 'candidate',
    features: ['summary'],
    notes: 'Higher quality, higher memory usage.',
  },
  {
    id: 'lfm2_5_350m_quantized',
    executorchModel: LFM2_5_350M_QUANTIZED,
    displayName: 'LFM 2.5 - 350M',
    recommendation: 'fallback',
    features: ['summary'],
    notes: 'For low-memory devices.',
  },
]

export function getModelById(id) {
  return FEEDOWN_LLM_MODELS.find((m) => m.id === id) ?? null
}
