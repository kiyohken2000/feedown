import {
  GEMMA4_E2B,
  LFM2_5_1_2B_INSTRUCT_QUANTIZED,
  LFM2_5_350M_QUANTIZED,
  QWEN3_0_6B_QUANTIZED,
  QWEN3_1_7B_QUANTIZED,
  QWEN3_5_0_8B_QUANTIZED,
  QWEN3_5_2B_QUANTIZED,
} from 'react-native-executorch'
import { RAM_TIER } from './llama/models'

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
  {
    // executorch 0.9.1 で追加。iOS は MLX int4 (~2.89 GB), Android は
    // Vulkan 8da4w (~2.57 GB) を自動選択。
    //
    // RAM gate: iPhone 13 mini (3.6 GB reported, 4 GB physical) で jetsam
    // OOM が実機確認済み、iPhone Air (11.5 GB, A19 Pro) で動作確認済み。
    // 6 GB / 8 GB 端末は未検証のため保守的に TIER_8GB を要求 (iPhone 15
    // Pro / 16 / 16 Plus / iPad Air M1+ など)。Warm decode は ~30 tok/s で
    // LFM 2.5 1.2B の半分程度、初回 cold load は Metal shader コンパイル
    // で ~54s かかる点に注意。
    id: 'gemma4_e2b',
    executorchModel: GEMMA4_E2B,
    displayName: 'Gemma 4 - E2B (experimental)',
    recommendation: 'candidate',
    features: ['summary'],
    notes:
      '~2.9 GB. First load takes ~1 min (Metal shader compile, cached after).',
    maxInputChars: 5000,
    minDeviceRamBytes: RAM_TIER.TIER_8GB,
  },
]

export function getModelById(id) {
  return FEEDOWN_LLM_MODELS.find((m) => m.id === id) ?? null
}
