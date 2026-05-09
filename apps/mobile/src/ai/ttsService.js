import * as FileSystem from 'expo-file-system/legacy'

const SAMPLE_RATE = 24000  // Kokoro outputs at 24 kHz

export function summaryToSpeakableText(result) {
  if (!result?.summary?.length) return ''
  const text = result.summary.join('. ')
  if (result.caveats?.length) {
    return text + '. Note: ' + result.caveats.join('. ')
  }
  return text
}

function uint8ToBase64(bytes) {
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    binary += String.fromCharCode.apply(null, chunk)
  }
  return btoa(binary)
}

export function float32ToWavBase64(samples) {
  const numSamples = samples.length
  const dataSize = numSamples * 2  // 16-bit PCM
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const ws = (off, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
  }
  ws(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  ws(8, 'WAVE')
  ws(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)              // PCM
  view.setUint16(22, 1, true)              // mono
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true) // byteRate
  view.setUint16(32, 2, true)              // blockAlign
  view.setUint16(34, 16, true)             // bitsPerSample
  ws(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    offset += 2
  }

  return uint8ToBase64(new Uint8Array(buffer))
}

export async function writeTempWav(samples) {
  const base64 = float32ToWavBase64(samples)
  const path = `${FileSystem.cacheDirectory}feedown_tts.wav`
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: 'base64',
  })
  return path
}
