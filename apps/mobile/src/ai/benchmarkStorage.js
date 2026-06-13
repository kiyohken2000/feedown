import AsyncStorage from '@react-native-async-storage/async-storage'

// 単一の JSON object に全モデルの latest result を入れる方式。モデル数は
// 高々 6 程度で payload も小さいので bucketing は不要。
const KEY = 'feedown.benchmark.results.v1'

// shape: { [modelId]: BenchmarkResult }
//   BenchmarkResult = {
//     modelId, coldLoadMs, prompts: [{promptId, ttftMs, totalMs, decodeMs,
//     chars, charsPerSec}], runAt
//   }

export async function getAllBenchmarkResults() {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export async function saveBenchmarkResult(result) {
  if (!result?.modelId) return
  try {
    const all = await getAllBenchmarkResults()
    all[result.modelId] = result
    await AsyncStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // AsyncStorage 容量制限など。失敗しても benchmark 自体の動作には影響なし
  }
}

export async function clearBenchmarkResults() {
  try {
    await AsyncStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
