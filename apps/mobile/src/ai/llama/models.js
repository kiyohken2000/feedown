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
