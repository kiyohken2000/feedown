import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import * as Device from 'expo-device'
import * as Clipboard from 'expo-clipboard'
import { colors, fontSize, getThemeColors } from '../../theme'
import { useTheme } from '../../contexts/ThemeContext'
import { useAi } from '../../contexts/AiContext'
import {
  ALL_BENCHMARK_MODELS,
  BENCHMARK_PROMPTS_SUMMARY,
  BENCHMARK_PROMPTS_TRANSLATION,
  evaluateResult,
  getBenchmarkModelById,
  useBenchmarkRunner,
} from '../../ai/benchmark'
import {
  getAllBenchmarkResults,
  saveBenchmarkResult,
  clearBenchmarkResults,
} from '../../ai/benchmarkStorage'
import { showToast, showErrorToast } from '../../utils/showToast'

function fmtMs(ms) {
  if (!ms || ms <= 0) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function fmtRate(charsPerSec) {
  if (!charsPerSec || charsPerSec <= 0) return '—'
  const tokensPerSec = charsPerSec / 4
  return `${Math.round(charsPerSec)} ch/s · ~${tokensPerSec.toFixed(1)} tok/s`
}

function fmtBytes(bytes) {
  if (!bytes || bytes <= 0) return '—'
  const GB = 1024 ** 3
  return `${(bytes / GB).toFixed(1)} GB`
}

function fmtDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString()
}

const TIER_COLORS = {
  snappy: '#00aa00',
  good: '#00aa00',
  slow: '#cc8400',
  poor: colors.redSecondary,
  unknown: colors.gray,
}

function buildDeviceBlock(deviceInfo) {
  const lines = []
  lines.push(`FeedOwn Benchmark — ${new Date().toLocaleString()}`)
  lines.push(
    `Device: ${deviceInfo.modelName ?? 'unknown'} (${deviceInfo.osName ?? '?'} ${deviceInfo.osVersion ?? '?'})`,
  )
  lines.push(`RAM: ${fmtBytes(deviceInfo.totalMemory)}`)
  return lines.join('\n')
}

function buildResultBlock(result) {
  const lines = []
  const model = getBenchmarkModelById(result.modelId)
  const name = model?.displayName ?? result.modelId
  const kind = model?.kind ?? 'summary'
  const verdict = evaluateResult(result, kind)
  const prompts = result.prompts ?? []
  const avgRate =
    prompts.length > 0
      ? prompts.reduce((s, p) => s + (p.charsPerSec ?? 0), 0) / prompts.length
      : 0
  const avgTtft =
    prompts.length > 0
      ? prompts.reduce((s, p) => s + (p.ttftMs ?? 0), 0) / prompts.length
      : 0

  lines.push(`## ${name} [${kind}]`)
  lines.push(`Verdict: ${verdict.label} — ${verdict.detail}`)
  lines.push(
    `Cold load: ${result.coldLoadMs > 0 ? fmtMs(result.coldLoadMs) : '(warm)'}`,
  )
  lines.push(`Avg TTFT:  ${fmtMs(avgTtft)}`)
  lines.push(`Avg decode: ${fmtRate(avgRate)}`)
  lines.push('')
  for (const p of prompts) {
    lines.push(
      `- ${p.label}: TTFT ${fmtMs(p.ttftMs)} · ${fmtRate(p.charsPerSec)} · ${p.chars} chars in ${fmtMs(p.totalMs)}`,
    )
  }
  return lines.join('\n')
}

function buildClipboardText(deviceInfo, savedResults) {
  const parts = [buildDeviceBlock(deviceInfo), '']
  for (const r of savedResults) {
    parts.push(buildResultBlock(r))
    parts.push('')
  }
  return parts.join('\n')
}

export default function Benchmark() {
  const navigation = useNavigation()
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)
  const { settings: aiSettings } = useAi()
  const { phase, progress, runBenchmark, reset, cancel } = useBenchmarkRunner()

  const [checkedIds, setCheckedIds] = useState([])
  const [savedResults, setSavedResults] = useState({})
  const [outerProgress, setOuterProgress] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  // outer (model) ループ break 用。useState だと closure に古い値が
  // キャプチャされるので ref で持つ。
  const cancelledRef = useRef(false)

  useEffect(() => {
    getAllBenchmarkResults().then(setSavedResults)
  }, [])

  const deviceInfo = useMemo(
    () => ({
      modelName: Device.modelName,
      osName: Device.osName,
      osVersion: Device.osVersion,
      totalMemory: Device.totalMemory,
    }),
    [],
  )

  // ダウンロード済みのモデル一覧 (executorch + Hy-MT2)
  const downloadedIds = aiSettings.downloadedModelIds ?? []
  const benchmarkableModels = ALL_BENCHMARK_MODELS.filter((m) => {
    if (m.backend === 'executorch') return downloadedIds.includes(m.id)
    if (m.backend === 'llama.rn') return aiSettings.hyMt2Downloaded === true
    return false
  })

  const isRunning = outerProgress !== null

  const toggleChecked = useCallback(
    (id) => {
      if (isRunning) return
      setCheckedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      )
    },
    [isRunning],
  )

  const selectAll = useCallback(() => {
    if (isRunning) return
    setCheckedIds(benchmarkableModels.map((m) => m.id))
  }, [benchmarkableModels, isRunning])

  const clearSelection = useCallback(() => {
    if (isRunning) return
    setCheckedIds([])
  }, [isRunning])

  const onRun = useCallback(async () => {
    if (checkedIds.length === 0 || isRunning) return

    // ALL_BENCHMARK_MODELS 順に正規化 (UI のチェック順より stable)
    const targets = benchmarkableModels.filter((m) => checkedIds.includes(m.id))
    cancelledRef.current = false

    // run 開始時に device 情報をログ — 完了モデルブロックは個別に出すので
    // metro console を遡れば全結果が連続して見える。最後に full text も出す。
    console.log('[benchmark] ===== start =====')
    console.log(buildDeviceBlock(deviceInfo))

    // この run で集めた結果。終了時の full text 用に保存済み履歴とマージする。
    const runResults = {}
    let completedCount = 0
    try {
      for (let i = 0; i < targets.length; i++) {
        if (cancelledRef.current) break
        const model = targets[i]
        setOuterProgress({
          modelIdx: i,
          total: targets.length,
          modelName: model.displayName,
          kind: model.kind,
        })
        const result = await runBenchmark(model)
        // cancel された (部分結果) は保存しない — 比較対象として
        // 不完全な数字が混ざるのを避ける
        if (result && !result.cancelled) {
          await saveBenchmarkResult(result)
          setSavedResults((prev) => ({ ...prev, [result.modelId]: result }))
          runResults[result.modelId] = result
          completedCount += 1
          console.log(`[benchmark] result\n${buildResultBlock(result)}`)
        }
        if (cancelledRef.current || result?.cancelled) break
      }
      if (cancelledRef.current) {
        showToast({
          title: 'Cancelled',
          body:
            completedCount > 0
              ? `${completedCount} model${completedCount > 1 ? 's' : ''} saved before cancel`
              : 'No results saved',
        })
      } else {
        showToast({
          title: 'Benchmark complete',
          body: `${completedCount} model${completedCount > 1 ? 's' : ''} measured`,
        })
      }
    } catch (err) {
      showErrorToast({
        title: 'Benchmark error',
        body: err?.message ?? 'Unknown error',
      })
    } finally {
      // 終了時に保存済み (履歴 + この run) をまとめて 1 ブロックでログ。
      // ユーザはここから一括コピーできる。
      const merged = { ...savedResults, ...runResults }
      const mergedEntries = Object.values(merged).sort(
        (a, b) => (a.runAt ?? 0) - (b.runAt ?? 0),
      )
      console.log('[benchmark] ===== full results =====')
      console.log(buildClipboardText(deviceInfo, mergedEntries))
      console.log('[benchmark] ===== end =====')
      setOuterProgress(null)
      setCancelling(false)
      reset()
    }
  }, [
    checkedIds,
    benchmarkableModels,
    isRunning,
    runBenchmark,
    reset,
    deviceInfo,
    savedResults,
  ])

  const onCancel = useCallback(() => {
    if (!isRunning || cancelling) return
    setCancelling(true)
    cancelledRef.current = true
    cancel()
  }, [isRunning, cancelling, cancel])

  const onClearAll = useCallback(() => {
    Alert.alert('Clear All Results', 'Delete all saved benchmark results?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearBenchmarkResults()
          setSavedResults({})
          showToast({ title: 'Cleared', body: 'All results removed' })
        },
      },
    ])
  }, [])

  const savedEntries = Object.values(savedResults).sort(
    (a, b) => (a.runAt ?? 0) - (b.runAt ?? 0),
  )

  const onCopy = useCallback(async () => {
    if (savedEntries.length === 0) return
    const text = buildClipboardText(deviceInfo, savedEntries)
    try {
      await Clipboard.setStringAsync(text)
      showToast({ title: 'Copied', body: 'Benchmark text copied to clipboard' })
    } catch (err) {
      showErrorToast({ title: 'Copy failed', body: err?.message ?? 'Unknown error' })
    }
  }, [deviceInfo, savedEntries])

  const innerLabel = (() => {
    if (phase === 'loading') return 'loading model…'
    if (phase === 'running' && progress) {
      const list =
        outerProgress?.kind === 'translation'
          ? BENCHMARK_PROMPTS_TRANSLATION
          : BENCHMARK_PROMPTS_SUMMARY
      const p = list[progress.promptIdx]
      return `prompt ${progress.promptIdx + 1}/${progress.total} — ${p?.label ?? ''}`
    }
    return null
  })()

  const runLabel =
    checkedIds.length === 0
      ? 'Run Benchmark'
      : `Run Benchmark (${checkedIds.length})`

  const progressTitle = isRunning
    ? `Model ${outerProgress.modelIdx + 1}/${outerProgress.total} — ${outerProgress.modelName}`
    : null

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top', 'right', 'left']}
    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={isRunning}
        >
          <Text
            style={[
              styles.backText,
              { color: isRunning ? theme.textMuted : colors.primary },
            ]}
          >
            ← Back
          </Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Model Benchmark</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.contentContainer}>
        {/* Device specs */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Device</Text>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.deviceRow}>
              <Text style={[styles.deviceLabel, { color: theme.textMuted }]}>Model</Text>
              <Text style={[styles.deviceValue, { color: theme.text }]}>
                {deviceInfo.modelName ?? 'unknown'}
              </Text>
            </View>
            <View style={styles.deviceRow}>
              <Text style={[styles.deviceLabel, { color: theme.textMuted }]}>OS</Text>
              <Text style={[styles.deviceValue, { color: theme.text }]}>
                {deviceInfo.osName ?? '?'} {deviceInfo.osVersion ?? ''}
              </Text>
            </View>
            <View style={styles.deviceRow}>
              <Text style={[styles.deviceLabel, { color: theme.textMuted }]}>RAM</Text>
              <Text style={[styles.deviceValue, { color: theme.text }]}>
                {fmtBytes(deviceInfo.totalMemory)}
              </Text>
            </View>
          </View>
        </View>

        {/* Picker */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
              Pick models to compare
            </Text>
            {benchmarkableModels.length > 0 && !isRunning && (
              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={selectAll}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.headerActionText, { color: colors.primary }]}>
                    All
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={clearSelection}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.headerActionText, { color: theme.textMuted }]}>
                    Clear
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            {benchmarkableModels.length === 0 ? (
              <Text style={[styles.modelHint, { color: theme.textMuted, marginTop: 0 }]}>
                No downloaded models. Go to AI Settings to download one first.
              </Text>
            ) : (
              benchmarkableModels.map((model) => {
                const isChecked = checkedIds.includes(model.id)
                return (
                  <TouchableOpacity
                    key={model.id}
                    style={[
                      styles.modelRow,
                      { borderColor: theme.border },
                      isChecked && styles.modelRowSelected,
                    ]}
                    onPress={() => toggleChecked(model.id)}
                    disabled={isRunning}
                  >
                    <View style={styles.modelRowLeft}>
                      <View
                        style={[
                          styles.checkbox,
                          { borderColor: isChecked ? colors.primary : colors.gray },
                          isChecked && { backgroundColor: colors.primary },
                        ]}
                      >
                        {isChecked && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.modelNameRow}>
                          <Text style={[styles.modelName, { color: theme.text }]}>
                            {model.displayName}
                          </Text>
                          <Text
                            style={[
                              styles.kindBadge,
                              {
                                color:
                                  model.kind === 'translation'
                                    ? colors.bluePrimary
                                    : theme.textMuted,
                                borderColor:
                                  model.kind === 'translation'
                                    ? colors.bluePrimary
                                    : theme.border,
                              },
                            ]}
                          >
                            {model.kind}
                          </Text>
                        </View>
                        <Text style={[styles.modelNote, { color: theme.textMuted }]}>
                          {model.notes}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )
              })
            )}

            {isRunning ? (
              <>
                <View
                  style={[
                    styles.progressBox,
                    { borderColor: theme.border, backgroundColor: theme.background },
                  ]}
                >
                  <Text style={[styles.progressTitle, { color: theme.text }]}>
                    {progressTitle}
                  </Text>
                  {!!innerLabel && (
                    <Text style={[styles.progressSub, { color: theme.textMuted }]}>
                      {innerLabel}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[
                    styles.runButton,
                    {
                      borderColor: cancelling ? theme.border : colors.redSecondary,
                      backgroundColor: 'transparent',
                    },
                  ]}
                  onPress={onCancel}
                  disabled={cancelling}
                >
                  <Text
                    style={[
                      styles.runButtonText,
                      { color: cancelling ? theme.textMuted : colors.redSecondary },
                    ]}
                  >
                    {cancelling ? 'Cancelling…' : 'Cancel'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[
                  styles.runButton,
                  {
                    borderColor:
                      checkedIds.length === 0 ? theme.border : colors.primary,
                    backgroundColor:
                      checkedIds.length === 0 ? 'transparent' : colors.primary,
                  },
                ]}
                onPress={onRun}
                disabled={checkedIds.length === 0}
              >
                <Text
                  style={[
                    styles.runButtonText,
                    {
                      color:
                        checkedIds.length === 0 ? theme.textMuted : colors.white,
                    },
                  ]}
                >
                  {runLabel}
                </Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.modelHint, { color: theme.textMuted }]}>
              Runs 3 fixed prompts on each checked model sequentially. Summary
              models use English summarization prompts; translation models use
              EN→JA translation prompts. Cancel stops between prompts —
              partial results from the in-progress model are discarded.
            </Text>
          </View>
        </View>

        {/* Saved results */}
        {savedEntries.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                Results
              </Text>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={onCopy}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.headerActionText, { color: colors.primary }]}>
                    Copy
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onClearAll}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.headerActionText, { color: colors.redSecondary }]}>
                    Clear
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {savedEntries.map((r) => {
              const model = getBenchmarkModelById(r.modelId)
              const kind = model?.kind ?? 'summary'
              const verdict = evaluateResult(r, kind)
              const verdictColor = TIER_COLORS[verdict.tier] ?? TIER_COLORS.unknown
              const prompts = r.prompts ?? []
              const avgRate =
                prompts.length > 0
                  ? prompts.reduce((s, p) => s + (p.charsPerSec ?? 0), 0) /
                    prompts.length
                  : 0
              const avgTtft =
                prompts.length > 0
                  ? prompts.reduce((s, p) => s + (p.ttftMs ?? 0), 0) /
                    prompts.length
                  : 0
              return (
                <View
                  key={r.modelId}
                  style={[
                    styles.card,
                    { backgroundColor: theme.card, marginBottom: 12 },
                  ]}
                >
                  <Text style={[styles.resultModelName, { color: theme.text }]}>
                    {model?.displayName ?? r.modelId}
                  </Text>
                  <Text style={[styles.resultMeta, { color: theme.textMuted }]}>
                    {fmtDate(r.runAt)} · {kind}
                  </Text>

                  <View
                    style={[
                      styles.verdictBox,
                      { borderColor: verdictColor, backgroundColor: `${verdictColor}15` },
                    ]}
                  >
                    <Text style={[styles.verdictLabel, { color: verdictColor }]}>
                      {verdict.label}
                    </Text>
                    {!!verdict.detail && (
                      <Text style={[styles.verdictDetail, { color: theme.text }]}>
                        {verdict.detail}
                      </Text>
                    )}
                  </View>

                  <View style={styles.resultStatsRow}>
                    <View style={styles.resultStatCell}>
                      <Text style={[styles.resultStatLabel, { color: theme.textMuted }]}>
                        Cold load
                      </Text>
                      <Text style={[styles.resultStatValue, { color: theme.text }]}>
                        {r.coldLoadMs > 0 ? fmtMs(r.coldLoadMs) : '(warm)'}
                      </Text>
                    </View>
                    <View style={styles.resultStatCell}>
                      <Text style={[styles.resultStatLabel, { color: theme.textMuted }]}>
                        Avg TTFT
                      </Text>
                      <Text style={[styles.resultStatValue, { color: theme.text }]}>
                        {fmtMs(avgTtft)}
                      </Text>
                    </View>
                    <View style={styles.resultStatCell}>
                      <Text style={[styles.resultStatLabel, { color: theme.textMuted }]}>
                        Avg decode
                      </Text>
                      <Text style={[styles.resultStatValue, { color: theme.text }]}>
                        {fmtRate(avgRate)}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.divider, { backgroundColor: theme.border }]} />

                  {prompts.map((p) => (
                    <View key={p.promptId} style={styles.promptRow}>
                      <Text style={[styles.promptLabel, { color: theme.textMuted }]}>
                        {p.label}
                      </Text>
                      <View style={styles.promptMetrics}>
                        <Text style={[styles.promptMetric, { color: theme.text }]}>
                          TTFT {fmtMs(p.ttftMs)}
                        </Text>
                        <Text style={[styles.promptMetric, { color: theme.text }]}>
                          {fmtRate(p.charsPerSec)}
                        </Text>
                        <Text style={[styles.promptMetric, { color: theme.textMuted }]}>
                          {p.chars} chars in {fmtMs(p.totalMs)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: { minWidth: 64 },
  backText: { fontSize: fontSize.normal, fontWeight: '600' },
  title: { fontSize: fontSize.large, fontWeight: '600', textAlign: 'center' },
  headerSide: { minWidth: 64 },
  body: { flex: 1 },
  contentContainer: { paddingBottom: 40 },
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: fontSize.normal,
    fontWeight: '600',
    color: colors.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerActions: { flexDirection: 'row', gap: 14 },
  headerActionText: { fontSize: fontSize.small, fontWeight: '600' },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  deviceLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  deviceValue: { fontSize: fontSize.normal, fontWeight: '500' },
  modelRow: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
    padding: 12,
  },
  modelRowSelected: { borderColor: colors.primary },
  modelRowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkmark: { color: colors.white, fontSize: 13, fontWeight: '900', lineHeight: 14 },
  modelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  modelName: { fontSize: fontSize.normal, fontWeight: '500', marginBottom: 2 },
  kindBadge: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modelNote: { fontSize: fontSize.small, lineHeight: 18 },
  modelHint: {
    fontSize: fontSize.small,
    lineHeight: 18,
    marginTop: 12,
    fontStyle: 'italic',
  },
  progressBox: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  progressTitle: { fontSize: fontSize.small, fontWeight: '600' },
  progressSub: { fontSize: fontSize.small, marginTop: 4 },
  runButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  runButtonText: { fontSize: fontSize.normal, fontWeight: '600', textAlign: 'center' },
  resultModelName: { fontSize: fontSize.normal, fontWeight: '600' },
  resultMeta: { fontSize: fontSize.small, marginTop: 2 },
  verdictBox: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  verdictLabel: { fontSize: fontSize.normal, fontWeight: '700' },
  verdictDetail: { fontSize: fontSize.small, lineHeight: 18, marginTop: 4 },
  resultStatsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  resultStatCell: { flex: 1 },
  resultStatLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  resultStatValue: {
    fontSize: fontSize.small,
    fontWeight: '600',
    marginTop: 2,
  },
  divider: { height: 1, marginVertical: 12 },
  promptRow: { marginBottom: 8 },
  promptLabel: {
    fontSize: fontSize.small,
    fontWeight: '600',
    marginBottom: 4,
  },
  promptMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  promptMetric: { fontSize: fontSize.small },
})
