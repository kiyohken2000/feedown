// Executorch comparison bench for the llama.rn PoC (Phase D + translation).
// Runs the app's REAL prompts through react-native-executorch so its tok/s and
// output quality are directly comparable to the Hy-MT2 (llama.rn) card.
//   - translate mode: buildTranslationMessages on the SAME EN source as Hy-MT2
//   - summary mode:   the original BENCH_MESSAGES summary prompt
// Self-contained, safe to delete with the rest of the PoC once the verdict is made.

import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import {
  useLLM,
  LFM2_5_1_2B_INSTRUCT_QUANTIZED,
} from 'react-native-executorch'
import {
  BENCH_MESSAGES,
  BENCH_TRANSLATE_PARAGRAPHS,
} from '../../ai/llamaRnPoC'
import { buildTranslationMessages } from '../../ai/prompts'

// Compare against the current production default (closest size to Hy-MT2 1.8B).
const COMPARE_MODEL = LFM2_5_1_2B_INSTRUCT_QUANTIZED
const COMPARE_MODEL_LABEL = 'LFM2.5 1.2B quantized (prod default)'

export default function ExecutorchBenchCard({ theme }) {
  const [loadRequested, setLoadRequested] = useState(false)
  const [phase, setPhase] = useState('idle') // 'idle' | 'running'
  const [mode, setMode] = useState('translate') // 'translate' | 'summary'
  const [bench, setBench] = useState(null)
  const [error, setError] = useState(null)
  const loadStartRef = useRef(null)
  const loadMsRef = useRef(null)

  const llm = useLLM({
    model: COMPARE_MODEL,
    preventLoad: !loadRequested,
  })

  // Capture load time the first moment the model reports ready.
  useEffect(() => {
    if (llm.isReady && loadStartRef.current != null && loadMsRef.current == null) {
      loadMsRef.current = Date.now() - loadStartRef.current
    }
  }, [llm.isReady])

  const handleLoad = useCallback(() => {
    setError(null)
    loadStartRef.current = Date.now()
    loadMsRef.current = null
    setLoadRequested(true)
  }, [])

  const handleRun = useCallback(async () => {
    if (!llm.isReady) return
    setError(null)
    setBench(null)
    setPhase('running')
    try {
      // translate mode = app's REAL prompt on the SAME source as the Hy-MT2 card.
      const messages =
        mode === 'translate'
          ? buildTranslationMessages(BENCH_TRANSLATE_PARAGRAPHS, 'ja')
          : BENCH_MESSAGES
      // Match the llama.rn benchmark sampling (temp 0.7 / top_p 0.9).
      llm.configure({ generationConfig: { temperature: 0.7, topP: 0.9 } })
      const genStart = Date.now()
      const text = await llm.generate(messages)
      const generateMs = Date.now() - genStart
      const tokenCount = llm.getGeneratedTokenCount?.() ?? 0
      const tokensPerSec =
        tokenCount > 0 && generateMs > 0 ? (tokenCount * 1000) / generateMs : 0
      const result = { loadMs: loadMsRef.current, generateMs, tokenCount, tokensPerSec, text }
      console.log('[ExecutorchBench] OK:', JSON.stringify({ ...result, text: undefined }))
      console.log(
        `[ExecutorchBench] ===== ${mode.toUpperCase()} OUTPUT (${COMPARE_MODEL_LABEL}, ${tokensPerSec.toFixed(1)} tok/s) =====\n${text}\n[ExecutorchBench] ===== END =====`,
      )
      setBench(result)
    } catch (e) {
      const msg = e?.message ?? String(e)
      console.error('[ExecutorchBench] Benchmark failed:', msg, e)
      setError(msg)
    } finally {
      setPhase('idle')
    }
  }, [llm, mode])

  const busy = phase !== 'idle' || (loadRequested && !llm.isReady)

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
        executorch bench (vs Hy-MT2)
      </Text>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          Model: {COMPARE_MODEL_LABEL}
        </Text>
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          {mode === 'translate'
            ? 'Translate: same EN source as Hy-MT2 card, app’s real prompt'
            : 'Summary: same prompt as llama.rn summary bench'}
        </Text>

        {/* Mode toggle */}
        <View style={styles.pickerRow}>
          {['translate', 'summary'].map((m) => {
            const selected = m === mode
            return (
              <TouchableOpacity
                key={m}
                style={[
                  styles.pickerChip,
                  {
                    backgroundColor: selected ? '#3478f6' : 'transparent',
                    borderColor: selected ? '#3478f6' : theme.textMuted,
                  },
                  busy && { opacity: 0.5 },
                ]}
                disabled={busy}
                onPress={() => {
                  setMode(m)
                  setBench(null)
                }}
              >
                <Text
                  style={{
                    color: selected ? '#fff' : theme.text,
                    fontSize: 12,
                    fontWeight: '600',
                  }}
                >
                  {m}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Load (+ auto download on first run) */}
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: llm.isReady ? '#888' : '#7a3df6' },
            (busy || llm.isReady) && { opacity: 0.6 },
          ]}
          disabled={busy || llm.isReady}
          onPress={handleLoad}
        >
          {loadRequested && !llm.isReady ? (
            <View style={styles.row}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.buttonText}>
                {' '}
                {llm.downloadProgress > 0 && llm.downloadProgress < 1
                  ? `Downloading ${Math.round(llm.downloadProgress * 100)}%`
                  : 'Loading...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>
              {llm.isReady ? 'Model ready' : 'Load model (downloads first time)'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Run benchmark */}
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: '#22a06b' },
            (!llm.isReady || busy) && { opacity: 0.5 },
          ]}
          disabled={!llm.isReady || busy}
          onPress={handleRun}
        >
          {phase === 'running' ? (
            <View style={styles.row}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.buttonText}> Generating...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Run benchmark</Text>
          )}
        </TouchableOpacity>

        {bench && (
          <View style={[styles.resultBox, { borderColor: theme.textMuted }]}>
            <Text style={[styles.resultLine, { color: theme.text }]}>
              Load: {bench.loadMs ?? '?'} ms
            </Text>
            <Text style={[styles.resultLine, { color: theme.text }]}>
              Generate: {bench.generateMs} ms · {bench.tokenCount} tokens ·{' '}
              {bench.tokensPerSec.toFixed(1)} tok/s
            </Text>
            <ScrollView style={styles.textScroll} nestedScrollEnabled>
              <Text style={[styles.responseText, { color: theme.text }]}>
                {bench.text || '(empty response)'}
              </Text>
            </ScrollView>
          </View>
        )}

        {(error || llm.error) && (
          <ScrollView style={styles.errorScroll} nestedScrollEnabled>
            <Text style={[styles.errorText, { color: '#c0392b' }]} selectable>
              Error: {error || String(llm.error)}
            </Text>
          </ScrollView>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  card: { borderRadius: 12, padding: 14 },
  hint: { fontSize: 12, marginBottom: 8 },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  pickerChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  resultBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  resultLine: { fontSize: 13, marginBottom: 4 },
  textScroll: { maxHeight: 160, marginTop: 8 },
  responseText: { fontSize: 13, lineHeight: 18 },
  errorScroll: { marginTop: 8, maxHeight: 200 },
  errorText: { fontSize: 13 },
})
