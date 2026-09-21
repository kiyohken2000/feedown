// llama.rn-backed model catalog and device RAM gating.
//
// Production scope is intentionally narrow: only the translation specialist
// (Hy-MT2 1.8B Q4_K_M). Phase F (Gemma 3 1B-IT vs LFM2.5 1.2B summary bench
// on A15) showed executorch is 55% faster on the general-purpose path, so
// general LLM stays on executorch. See docs/llama-rn-post-merge-plan.md.
//
// Broader model lists (Hy-MT2 Q6_K, Gemma 3 1B, Gemma 4 E2B, Qwen3 0.6B) live
// on poc/llama-rn-gemma4 in apps/mobile/src/ai/llamaRnPoC.js for future
// benchmarking only.

import * as Device from 'expo-device'

// iOS Device.totalMemory returns usable RAM (~90% of physical). iPhone 13
// mini (4GB physical) reports 3.6GB. So tier thresholds sit just below the
// expected reported value of each class. Calibrated against iPhone 13 mini
// (A15, 4GB): Metal working set = 2863MB, app baseline + KV/compute ≈ 1GB,
// so safe weight cap is ~1.8GB on 4GB devices. 6/8GB tiers extrapolated.
export const RAM_TIER = {
  TIER_4GB: 3.5 * 1024 ** 3,
  TIER_6GB: 5.3 * 1024 ** 3,
  TIER_8GB: 7.0 * 1024 ** 3,
}

// Maps the (slightly-below-class) threshold back to the physical-class label,
// so the user-facing message says "Needs ~4GB+" not "Needs ~3GB+".
const RAM_TIER_LABEL = new Map([
  [RAM_TIER.TIER_4GB, '4'],
  [RAM_TIER.TIER_6GB, '6'],
  [RAM_TIER.TIER_8GB, '8'],
])

export function getDeviceRamBytes() {
  return Device.totalMemory ?? null
}

export function canRunOnDevice(model, ramBytes = getDeviceRamBytes()) {
  if (model?.minDeviceRamBytes == null) return { ok: true }
  if (ramBytes == null) {
    return { ok: false, reason: 'Device RAM unknown — cannot verify capacity' }
  }
  if (ramBytes < model.minDeviceRamBytes) {
    const need =
      RAM_TIER_LABEL.get(model.minDeviceRamBytes) ??
      Math.round(model.minDeviceRamBytes / 1024 ** 3).toString()
    const have = (ramBytes / 1024 ** 3).toFixed(1)
    return { ok: false, reason: `Needs ~${need}GB+ RAM (this device: ${have}GB)` }
  }
  return { ok: true }
}

// Hy-MT2 recommended sampling for non-Chinese targets (temp 0.7 / top_p 0.6
// / top_k 20 / rep_penalty 1.05) per the model card.
export const HY_MT2_SAMPLING = {
  temperature: 0.7,
  top_p: 0.6,
  top_k: 20,
  penalty_repeat: 1.05,
}

export const HY_MT2_TRANSLATION_MODEL = {
  id: 'Hy-MT2-1.8B-Q4_K_M',
  displayName: 'Hy-MT2 1.8B Q4_K_M',
  url: 'https://huggingface.co/tencent/Hy-MT2-1.8B-GGUF/resolve/main/Hy-MT2-1.8B-Q4_K_M.gguf',
  expectedBytes: 1_133_000_000, // ~1.13 GB
  minDeviceRamBytes: RAM_TIER.TIER_4GB,
  sampling: HY_MT2_SAMPLING,
}

// SemIf 方式 (1 トークン生成 + ラベル確率読み) の意味分類ベンチ用候補。
// _temp/HANDOFF_llama_rn_semif.md §4 のデスクトップ実測で Qwen3.5-4B は確率が
// 使える分布、Gemma 4 E2B は 0/1 飽和、LFM2.5-1.2B は yes バイアスで不適。
// 4B (Q4_K_M ~2.5GB) と Gemma 4 E2B (最小 2.4GB) は iPhone 13 mini で OOM
// 確定 (docs/llama-rn-post-merge-plan.md) なので、4GB 端末で載る Qwen3.5
// 2B / 0.8B を測る。Benchmark 画面からのみ DL/実行する (本番 UI には出さない)。
export const JUDGE_SAMPLING = {
  // サンプラ適用後の確率が返るので temperature は 1 固定 (handoff §2)
  temperature: 1,
  n_probs: 20,
}

export const SEMIF_JUDGE_MODELS = [
  {
    id: 'Qwen3.5-2B-Q4_K_M',
    displayName: 'Qwen3.5 2B Q4_K_M',
    url: 'https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf',
    expectedBytes: 1_280_835_840, // ~1.28 GB
    minDeviceRamBytes: RAM_TIER.TIER_4GB, // Hy-MT2 Q4 (1.13GB) と同クラス
    sampling: JUDGE_SAMPLING,
  },
  {
    id: 'Qwen3.5-0.8B-Q4_K_M',
    displayName: 'Qwen3.5 0.8B Q4_K_M',
    url: 'https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/resolve/main/Qwen3.5-0.8B-Q4_K_M.gguf',
    expectedBytes: 532_517_120, // ~533 MB
    minDeviceRamBytes: RAM_TIER.TIER_4GB,
    sampling: JUDGE_SAMPLING,
  },
]
