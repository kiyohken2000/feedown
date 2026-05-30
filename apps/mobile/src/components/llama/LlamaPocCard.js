// PoC card for llama.rn + Gemma 4 E2B Q4_K_M.
// Self-contained: no AiContext usage, no shared state. Safe to delete (with llamaRnPoC.js)
// once the verdict is made.

import React, { useEffect, useState, useCallback } from 'react'
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import {
  POC_MODELS,
  getModelStatus,
  downloadModel,
  deleteModel,
  runBenchmark,
  verifyModelIntegrity,
  diagNativeModule,
  enableNativeLog,
  probeBackends,
  probeModelInfo,
  getDeviceRamBytes,
  canRunPocModel,
} from '../../ai/llamaRnPoC'

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const KB = 1024
  const MB = KB * 1024
  const GB = MB * 1024
  if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`
  if (bytes >= MB) return `${(bytes / MB).toFixed(0)} MB`
  if (bytes >= KB) return `${(bytes / KB).toFixed(0)} KB`
  return `${bytes} B`
}

export default function LlamaPocCard({ theme }) {
  const [activeModel, setActiveModel] = useState(POC_MODELS[0])
  const [status, setStatus] = useState({ downloaded: false, bytes: 0 })
  const [phase, setPhase] = useState('idle') // 'idle' | 'downloading' | 'running'
  const [progress, setProgress] = useState(null)
  const [bench, setBench] = useState(null)
  const [error, setError] = useState(null)

  // Device RAM gate (option A). Computed once per mount; expo-device reads
  // are synchronous and safe to call at render time.
  const deviceRamBytes = getDeviceRamBytes()
  const deviceRamGB = deviceRamBytes != null ? (deviceRamBytes / 1024 ** 3).toFixed(1) : '?'
  const gate = canRunPocModel(activeModel, deviceRamBytes)

  const refreshStatus = useCallback(async (model = activeModel) => {
    try {
      const s = await getModelStatus(model)
      setStatus(s)
    } catch (e) {
      setError(e?.message ?? String(e))
    }
  }, [activeModel])

  useEffect(() => {
    refreshStatus(activeModel)
    setBench(null)
    setError(null)
  }, [activeModel, refreshStatus])

  const handleDownload = useCallback(async () => {
    setError(null)
    setPhase('downloading')
    setProgress({ percent: 0, totalBytesWritten: 0, totalBytesExpectedToWrite: activeModel.expectedBytes })
    try {
      const result = await downloadModel((p) => setProgress(p), activeModel)
      await refreshStatus(activeModel)
      Alert.alert(
        'Download complete',
        result.alreadyExisted
          ? 'Model was already present.'
          : `Downloaded ${formatBytes(result.bytes)} in ${(result.elapsedMs / 1000).toFixed(1)}s`,
      )
    } catch (e) {
      const msg = e?.message ?? String(e)
      console.error('[LlamaPocCard] Download failed:', msg, e)
      setError(msg)
      Alert.alert('Download failed', msg)
    } finally {
      setPhase('idle')
    }
  }, [activeModel, refreshStatus])

  const handleRun = useCallback(async () => {
    setError(null)
    setBench(null)
    setPhase('running')
    try {
      const result = await runBenchmark({ model: activeModel })
      setBench(result)
    } catch (e) {
      const msg = e?.message ?? String(e)
      console.error('[LlamaPocCard] Benchmark failed:', msg, e)
      setError(msg)
      Alert.alert('Benchmark failed', msg)
    } finally {
      setPhase('idle')
    }
  }, [activeModel])

  const handleDiagNative = useCallback(() => {
    const d = diagNativeModule()
    const msg = JSON.stringify(d, null, 2)
    console.log('[LlamaPocCard] diagNativeModule:', msg)
    Alert.alert(
      d.loaded ? 'Native module: LOADED' : 'Native module: NOT LOADED',
      msg,
    )
  }, [])

  const handleDeepDiag = useCallback(async () => {
    setError(null)
    try {
      await enableNativeLog() // pipe llama.cpp logs to console
      const b = await probeBackends()
      console.log('[LlamaPocCard] backends:', JSON.stringify(b, null, 2))
      const p = await probeModelInfo(activeModel)
      console.log('[LlamaPocCard] probeModelInfo:', JSON.stringify(p, null, 2))
      Alert.alert(
        'Deep diag',
        `backends.ok=${b.ok}\nprobe.ok=${p.ok}\n(See console for full output)`,
      )
    } catch (e) {
      const msg = e?.message ?? String(e)
      console.error('[LlamaPocCard] Deep diag failed:', msg, e)
      setError(msg)
      Alert.alert('Deep diag failed', msg)
    }
  }, [activeModel])

  const handleVerify = useCallback(async () => {
    setError(null)
    try {
      const v = await verifyModelIntegrity(activeModel)
      const msg = `magic=${v.magic ?? '?'} (${v.ok ? 'OK' : 'BAD'})\nbytes=${v.bytes} (expected ~${activeModel.expectedBytes})\n${v.reason}`
      console.log('[LlamaPocCard] Verify:', msg)
      Alert.alert(v.ok ? 'GGUF OK' : 'GGUF BAD', msg)
    } catch (e) {
      const msg = e?.message ?? String(e)
      console.error('[LlamaPocCard] Verify failed:', msg, e)
      setError(msg)
      Alert.alert('Verify failed', msg)
    }
  }, [activeModel])

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete PoC model',
      `Delete "${activeModel.displayName}" (${formatBytes(status.bytes)})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteModel(activeModel)
              setBench(null)
              await refreshStatus(activeModel)
            } catch (e) {
              const msg = e?.message ?? String(e)
              console.error('[LlamaPocCard] Delete failed:', msg, e)
              setError(msg)
            }
          },
        },
      ],
    )
  }, [activeModel, status.bytes, refreshStatus])

  const busy = phase !== 'idle'

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
        llama.rn PoC (temporary)
      </Text>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        {/* Device RAM tier */}
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          Device RAM: {deviceRamGB} GB (Device.totalMemory)
        </Text>

        {/* Model picker — incompatible models are dimmed but still selectable
            so you can inspect the gate reason without losing the picker UX. */}
        <View style={styles.pickerRow}>
          {POC_MODELS.map((m) => {
            const selected = m.id === activeModel.id
            const compat = canRunPocModel(m, deviceRamBytes).ok
            const dim = !compat && !selected
            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.pickerChip,
                  {
                    backgroundColor: selected ? '#3478f6' : 'transparent',
                    borderColor: selected ? '#3478f6' : theme.textMuted,
                  },
                  (busy || dim) && { opacity: dim ? 0.4 : 0.5 },
                ]}
                disabled={busy}
                onPress={() => setActiveModel(m)}
              >
                <Text
                  style={{
                    color: selected ? '#fff' : theme.text,
                    fontSize: 12,
                    fontWeight: '600',
                  }}
                >
                  {compat ? '' : '🚫 '}{m.displayName}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          {activeModel.note}
        </Text>
        {!gate.ok && (
          <Text style={[styles.hint, { color: '#c0392b' }]}>
            ⚠ {gate.reason}
          </Text>
        )}
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          {status.downloaded
            ? `Downloaded · ${formatBytes(status.bytes)}`
            : `Not downloaded · ~${formatBytes(activeModel.expectedBytes)}`}
        </Text>

        {/* Download — blocked when device RAM gate fails (prevents wasting
            ~GB of cellular data on a model that can't load anyway). */}
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: status.downloaded ? '#888' : '#3478f6' },
            (busy || !gate.ok) && { opacity: 0.5 },
          ]}
          disabled={busy || status.downloaded || !gate.ok}
          onPress={handleDownload}
        >
          {phase === 'downloading' ? (
            <View style={styles.row}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.buttonText}>
                {' '}
                {progress
                  ? `${(progress.percent * 100).toFixed(1)}% · ${formatBytes(progress.totalBytesWritten)}/${formatBytes(progress.totalBytesExpectedToWrite)}`
                  : 'Starting...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>
              {status.downloaded ? 'Downloaded' : 'Download model'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Run benchmark — also blocked by gate (defence in depth: even if
            the file was already on disk from a prior tier check). */}
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: '#22a06b' },
            (!status.downloaded || busy || !gate.ok) && { opacity: 0.5 },
          ]}
          disabled={!status.downloaded || busy || !gate.ok}
          onPress={handleRun}
        >
          {phase === 'running' ? (
            <View style={styles.row}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.buttonText}> Loading + generating...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Load + run benchmark</Text>
          )}
        </TouchableOpacity>

        {/* Diag native module */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#5a6c84' }, busy && { opacity: 0.5 }]}
          disabled={busy}
          onPress={handleDiagNative}
        >
          <Text style={styles.buttonText}>Check native module loaded</Text>
        </TouchableOpacity>

        {/* Deep diag: backends + model probe + native logs on */}
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: '#5a6c84' },
            (!status.downloaded || busy) && { opacity: 0.5 },
          ]}
          disabled={!status.downloaded || busy}
          onPress={handleDeepDiag}
        >
          <Text style={styles.buttonText}>Deep diag (backends + probe + log)</Text>
        </TouchableOpacity>

        {/* Verify */}
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: '#5a6c84' },
            (!status.downloaded || busy) && { opacity: 0.5 },
          ]}
          disabled={!status.downloaded || busy}
          onPress={handleVerify}
        >
          <Text style={styles.buttonText}>Verify GGUF integrity</Text>
        </TouchableOpacity>

        {/* Delete */}
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: '#c0392b' },
            (!status.downloaded || busy) && { opacity: 0.5 },
          ]}
          disabled={!status.downloaded || busy}
          onPress={handleDelete}
        >
          <Text style={styles.buttonText}>Delete model</Text>
        </TouchableOpacity>

        {/* Results */}
        {bench && (
          <View style={[styles.resultBox, { borderColor: theme.textMuted }]}>
            <Text style={[styles.resultLine, { color: theme.text }]}>
              Load: {bench.loadMs} ms · GPU layers used:{' '}
              {bench.gpuLayersUsed ?? '?'}{bench.gpuLayersUsed === 0 ? ' (CPU fallback)' : ''}
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

        {error && (
          <ScrollView style={styles.errorScroll} nestedScrollEnabled>
            <Text style={[styles.errorText, { color: '#c0392b' }]} selectable>
              Error: {error}
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
  label: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
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
