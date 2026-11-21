import React, { useState, useCallback, useEffect } from 'react'
import {
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  Switch,
  Linking,
  AppState,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { colors, fontSize, getThemeColors } from '../../theme'
import { useTheme } from '../../contexts/ThemeContext'
import { showToast, showErrorToast } from '../../utils/showToast'
import {
  DEFAULT_BG_SETTINGS,
  THRESHOLD_OPTIONS,
  getBackgroundTaskStatus,
  getNotificationPermission,
  loadBgSettings,
  loadRunLog,
  requestNotificationPermission,
  runBackgroundRefresh,
  sendTestNotification,
  updateBgSettings,
} from '../../utils/backgroundRefresh'

const SKIP_LABELS = {
  off: 'skipped (off)',
  active: 'skipped (app open)',
  'signed-out': 'skipped (signed out)',
  'rate-limited': 'skipped (refreshed in the last 30s)',
}

function formatTime(ms) {
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function describeRun(run) {
  const parts = []
  if (typeof run.newArticles === 'number') parts.push(`${run.newArticles} new`)
  if (run.notified) parts.push('notified')
  if (run.skipped) parts.push(SKIP_LABELS[run.skipped] || `skipped (${run.skipped})`)
  if (run.error) parts.push(`error: ${run.error}`)
  return parts.join(', ') || 'done'
}

export default function BackgroundRefreshSettings() {
  const navigation = useNavigation()
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)

  const [settings, setSettings] = useState(DEFAULT_BG_SETTINGS)
  const [permission, setPermission] = useState(null)
  const [taskStatus, setTaskStatus] = useState(null)
  const [runs, setRuns] = useState([])
  const [isChecking, setIsChecking] = useState(false)

  const reload = useCallback(async () => {
    const [s, p, t, r] = await Promise.all([
      loadBgSettings(),
      getNotificationPermission(),
      getBackgroundTaskStatus(),
      loadRunLog(),
    ])
    setSettings(s)
    setPermission(p)
    setTaskStatus(t)
    setRuns(r)
  }, [])

  // Re-check on return from the OS settings (permission may have changed)
  useEffect(() => {
    reload()
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') reload()
    })
    return () => sub.remove()
  }, [reload])

  const update = useCallback(async (patch) => {
    setSettings(await updateBgSettings(patch))
    setTaskStatus(await getBackgroundTaskStatus())
  }, [])

  const openOsSettings = useCallback(() => {
    Linking.openSettings().catch(() => {})
  }, [])

  const handleToggleNotify = useCallback(async (on) => {
    if (on) {
      const granted =
        (await getNotificationPermission()) === 'granted' ||
        (await requestNotificationPermission())
      setPermission(await getNotificationPermission())
      if (!granted) {
        Alert.alert(
          'Notifications are off',
          'Allow notifications for FeedOwn in the system settings to get new article alerts.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: openOsSettings },
          ]
        )
        return
      }
    }
    await update({ notify: on })
  }, [update, openOsSettings])

  const handleTestNotification = useCallback(async () => {
    if ((await getNotificationPermission()) !== 'granted') {
      showErrorToast({ title: 'Notifications are off', body: 'Allow notifications first' })
      return
    }
    try {
      await sendTestNotification()
    } catch (err) {
      showErrorToast({ title: 'Error', body: err?.message ?? 'Failed to send' })
    }
  }, [])

  const handleCheckNow = useCallback(async () => {
    setIsChecking(true)
    try {
      const result = await runBackgroundRefresh({ foreground: true })
      if (result.error) {
        showErrorToast({ title: 'Check failed', body: result.error })
      } else if (result.skipped) {
        showErrorToast({ title: 'Skipped', body: SKIP_LABELS[result.skipped] || result.skipped })
      } else {
        showToast({ title: 'Checked', body: `${result.newArticles} new articles` })
      }
    } finally {
      setIsChecking(false)
      setRuns(await loadRunLog())
    }
  }, [])

  const switchProps = (value) => ({
    trackColor: { false: '#767577', true: colors.primary },
    thumbColor: value ? colors.white : '#f4f3f4',
  })

  const restrictedNote = Platform.OS === 'ios'
    ? 'Background App Refresh is off for FeedOwn. Turn it on in the system settings.'
    : 'Background work is restricted for FeedOwn by the system.'

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top', 'right', 'left']}
    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Background Refresh</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.contentContainer}>
        {/* Background refresh */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Refresh</Text>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={[styles.toggleLabel, { color: theme.text }]}>Background Refresh</Text>
                <Text style={[styles.toggleDescription, { color: theme.textMuted }]}>
                  Check your feeds for new articles while the app is closed
                </Text>
              </View>
              <Switch
                testID="bg-refresh-switch"
                value={settings.enabled}
                onValueChange={(v) => update({ enabled: v })}
                {...switchProps(settings.enabled)}
              />
            </View>
            <Text style={[styles.hint, { color: theme.textMuted }]}>
              The system decides when to run it (at most every 15 minutes).
              {Platform.OS === 'ios' ? ' On iOS it may run only a few times a day.' : ''}
            </Text>
            {settings.enabled && taskStatus?.restricted && (
              <TouchableOpacity onPress={openOsSettings}>
                <Text style={[styles.warning, { color: colors.redSecondary }]}>{restrictedNote}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Notifications</Text>
          <View style={[styles.card, { backgroundColor: theme.card }, !settings.enabled && styles.disabled]}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={[styles.toggleLabel, { color: theme.text }]}>Notify New Articles</Text>
                <Text style={[styles.toggleDescription, { color: theme.textMuted }]}>
                  Turn off to only fetch in the background without alerts
                </Text>
              </View>
              <Switch
                testID="bg-notify-switch"
                value={settings.notify}
                onValueChange={handleToggleNotify}
                disabled={!settings.enabled}
                {...switchProps(settings.notify)}
              />
            </View>
            {settings.notify && permission === 'denied' && (
              <TouchableOpacity onPress={openOsSettings}>
                <Text style={[styles.warning, { color: colors.redSecondary }]}>
                  Notifications are blocked in the system settings. Tap to open them.
                </Text>
              </TouchableOpacity>
            )}

            {settings.notify && (
              <>
                <Text style={[styles.toggleLabel, styles.thresholdLabel, { color: theme.text }]}>
                  Notify When At Least
                </Text>
                <Text style={[styles.toggleDescription, { color: theme.textMuted, marginBottom: 12 }]}>
                  New articles are counted until they reach this number
                </Text>
                <View style={styles.options}>
                  {THRESHOLD_OPTIONS.map((n) => {
                    const active = settings.threshold === n
                    return (
                      <TouchableOpacity
                        key={n}
                        testID={`bg-threshold-${n}`}
                        style={[
                          styles.optionButton,
                          { borderColor: theme.border },
                          active && styles.optionButtonActive,
                        ]}
                        onPress={() => update({ threshold: n })}
                        disabled={!settings.enabled}
                      >
                        <Text
                          style={[
                            styles.optionButtonText,
                            { color: theme.text },
                            active && styles.optionButtonTextActive,
                          ]}
                        >
                          {n}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </>
            )}
          </View>
        </View>

        {/* Diagnostics */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Diagnostics</Text>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                testID="bg-test-notification"
                style={[styles.actionButton, { borderColor: theme.border }]}
                onPress={handleTestNotification}
              >
                <Text style={[styles.actionButtonText, { color: theme.text }]}>Test Notification</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="bg-check-now"
                style={[styles.actionButton, { borderColor: theme.border }, isChecking && styles.disabled]}
                onPress={handleCheckNow}
                disabled={isChecking}
              >
                <Text style={[styles.actionButtonText, { color: theme.text }]}>
                  {isChecking ? 'Checking…' : 'Check Now'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text testID="bg-status" style={[styles.statusLine, { color: theme.textMuted }]}>
              Task: {taskStatus?.registered ? 'registered' : 'not registered'}
              {taskStatus?.restricted ? ' (restricted)' : ''}
              {' · '}Notifications: {permission ?? '…'}
            </Text>

            <Text style={[styles.toggleLabel, styles.runsLabel, { color: theme.text }]}>Recent Runs</Text>
            {runs.length === 0 ? (
              <Text style={[styles.toggleDescription, { color: theme.textMuted }]}>No runs yet</Text>
            ) : (
              runs.map((run, i) => (
                <View key={`${run.at}-${i}`} style={[styles.runRow, { borderTopColor: theme.border }]}>
                  <Text style={[styles.runTime, { color: theme.text }]}>
                    {formatTime(run.at)}
                    <Text style={{ color: theme.textMuted }}>{run.background ? '  background' : '  manual'}</Text>
                  </Text>
                  <Text style={[styles.runDetail, { color: theme.textMuted }]}>{describeRun(run)}</Text>
                </View>
              ))
            )}
          </View>
        </View>
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
  sectionTitle: {
    fontSize: fontSize.normal,
    fontWeight: '600',
    color: colors.gray,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
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
  disabled: { opacity: 0.5 },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleText: { flex: 1, marginRight: 12 },
  toggleLabel: {
    fontSize: fontSize.normal,
    fontWeight: '600',
    color: colors.black,
  },
  toggleDescription: {
    fontSize: fontSize.small,
    color: colors.gray,
    marginTop: 4,
  },
  hint: { fontSize: fontSize.small, lineHeight: 18, marginTop: 12, fontStyle: 'italic' },
  warning: { fontSize: fontSize.small, lineHeight: 18, marginTop: 12, fontWeight: '500' },
  thresholdLabel: { marginTop: 20 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.grayLight,
  },
  optionButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionButtonText: { fontSize: fontSize.small, fontWeight: '500' },
  optionButtonTextActive: { color: colors.white },
  buttonRow: { flexDirection: 'row', gap: 8 },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionButtonText: { fontSize: fontSize.small, fontWeight: '600' },
  statusLine: { fontSize: fontSize.small, marginTop: 12 },
  runsLabel: { marginTop: 16, marginBottom: 4 },
  runRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  runTime: { fontSize: fontSize.small, fontWeight: '600' },
  runDetail: { fontSize: fontSize.small, marginTop: 2 },
})
