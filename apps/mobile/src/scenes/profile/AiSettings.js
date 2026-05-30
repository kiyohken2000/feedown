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
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { colors, fontSize, getThemeColors } from '../../theme'
import { useTheme } from '../../contexts/ThemeContext'
import { useAi } from '../../contexts/AiContext'
import { FEEDOWN_LLM_MODELS } from '../../ai/models'
import { OUTPUT_LANGUAGES, TTS_VOICE_OPTIONS } from '../../ai/aiStorage'
import { showToast, showErrorToast } from '../../utils/showToast'
import Spinner from 'react-native-loading-spinner-overlay'

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return ''
  const KB = 1024
  const MB = KB * 1024
  const GB = MB * 1024
  if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`
  if (bytes >= MB) return `${(bytes / MB).toFixed(0)} MB`
  if (bytes >= KB) return `${(bytes / KB).toFixed(0)} KB`
  return `${bytes} B`
}

export default function AiSettings() {
  const navigation = useNavigation()
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)
  const {
    llm,
    settings: aiSettings,
    updateSettings: updateAiSettings,
    getModelSize,
    deleteModel,
  } = useAi()
  // const { llm, tts, settings: aiSettings, updateSettings: updateAiSettings } = useAi()  // TTS: restore tts when re-enabling
  const [isLoading, setIsLoading] = useState(false)
  const [modelSizes, setModelSizes] = useState({})

  const downloadedKey = (aiSettings.downloadedModelIds ?? []).join(',')
  useEffect(() => {
    let cancelled = false
    const ids = aiSettings.downloadedModelIds ?? []
    if (ids.length === 0) {
      setModelSizes({})
      return
    }
    Promise.all(ids.map((id) => getModelSize(id).then((bytes) => [id, bytes])))
      .then((entries) => {
        if (!cancelled) setModelSizes(Object.fromEntries(entries))
      })
      .catch(() => { /* ignore */ })
    return () => { cancelled = true }
  }, [downloadedKey, getModelSize])

  const handleDeleteModel = useCallback((model) => {
    const sizeLabel = formatBytes(modelSizes[model.id])
    Alert.alert(
      'Delete Model',
      `Delete "${model.displayName}"${sizeLabel ? ` (${sizeLabel})` : ''}? You can re-download it later, but it may take several minutes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true)
              await deleteModel(model.id)
              setModelSizes((prev) => {
                const next = { ...prev }
                delete next[model.id]
                return next
              })
              showToast({ title: 'Deleted', body: `${model.displayName} removed` })
            } catch (err) {
              showErrorToast({ title: 'Error', body: err?.message ?? 'Failed to delete model' })
            } finally {
              setIsLoading(false)
            }
          },
        },
      ],
    )
  }, [deleteModel, modelSizes])

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
        <Text style={[styles.title, { color: theme.text }]}>On-Device AI</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.contentContainer}>
        {/* On-Device AI */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>On-Device AI</Text>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            {/* Enable toggle */}
            <View style={styles.toggleRow}>
              <View>
                <Text style={[styles.toggleLabel, { color: theme.text }]}>AI Summary</Text>
                <Text style={[styles.toggleDescription, { color: theme.textMuted }]}>
                  Summarize articles using an on-device LLM
                </Text>
              </View>
              <Switch
                value={aiSettings.enabled}
                onValueChange={(v) => updateAiSettings({ enabled: v })}
                trackColor={{ false: '#767577', true: colors.primary }}
                thumbColor={aiSettings.enabled ? colors.white : '#f4f3f4'}
              />
            </View>

            {/* Model selection */}
            {aiSettings.enabled && (
              <>
                <Text style={[styles.label, styles.modelLabel, { color: theme.textMuted }]}>
                  Model
                </Text>
                {FEEDOWN_LLM_MODELS.map((model) => {
                  const isSelected = aiSettings.selectedModelId === model.id
                  const isDownloadedLocally = (aiSettings.downloadedModelIds ?? []).includes(model.id)
                  const isActive = isSelected && llm.isReady
                  const progress = isSelected ? llm.downloadProgress : 0
                  const isDownloading = isSelected && aiSettings.downloadEnabled && progress > 0 && progress < 1
                  const isPending = isSelected && aiSettings.downloadEnabled && !isActive && !isDownloading
                  const sizeLabel = formatBytes(modelSizes[model.id])
                  const canDelete = isDownloadedLocally && !isActive && !isDownloading && !isPending

                  return (
                    <TouchableOpacity
                      key={model.id}
                      style={[
                        styles.modelRow,
                        { borderColor: theme.border },
                        isSelected && styles.modelRowSelected,
                      ]}
                      onPress={() => updateAiSettings({ selectedModelId: model.id })}
                    >
                      <View style={styles.modelRowContent}>
                        <View style={styles.modelRowLeft}>
                          <View style={[styles.radioCircle, isSelected && { borderColor: colors.primary }]}>
                            {isSelected && <View style={styles.radioFill} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.modelName, { color: theme.text }]}>
                              {model.displayName}
                            </Text>
                            <Text style={[styles.modelNote, { color: theme.textMuted }]}>
                              {model.notes}
                              {sizeLabel ? `  •  ${sizeLabel}` : ''}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.modelStatus}>
                          {isActive && (
                            <View style={[styles.badge, styles.badgeActive]}>
                              <Text style={styles.badgeTextActive}>Active</Text>
                            </View>
                          )}
                          {isDownloading && (
                            <Text style={[styles.modelStatusText, { color: theme.textMuted }]}>
                              {Math.round(progress * 100)}%
                            </Text>
                          )}
                          {isPending && (
                            <Text style={[styles.modelStatusText, { color: theme.textMuted }]}>
                              Loading...
                            </Text>
                          )}
                          {!isActive && !isDownloading && !isPending && (
                            <View style={[
                              styles.badge,
                              isDownloadedLocally ? styles.badgeDownloaded : styles.badgeNotDownloaded,
                            ]}>
                              <Text style={[
                                styles.badgeText,
                                isDownloadedLocally ? styles.badgeTextDownloaded : styles.badgeTextNotDownloaded,
                              ]}>
                                {isDownloadedLocally ? 'Downloaded' : 'Not downloaded'}
                              </Text>
                            </View>
                          )}
                        </View>

                        {canDelete && (
                          <TouchableOpacity
                            style={styles.modelDeleteButton}
                            onPress={() => handleDeleteModel(model)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={styles.modelDeleteButtonText}>Delete</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  )
                })}

                {/* Output language */}
                <Text style={[styles.label, styles.modelLabel, { color: theme.textMuted }]}>
                  Summary Language
                </Text>
                <View style={styles.languageOptions}>
                  {OUTPUT_LANGUAGES.map((lang) => {
                    const isActive = (aiSettings.outputLanguage ?? 'ja') === lang.code
                    return (
                      <TouchableOpacity
                        key={lang.code}
                        style={[
                          styles.languageButton,
                          { borderColor: theme.border },
                          isActive && styles.languageButtonActive,
                        ]}
                        onPress={() => updateAiSettings({ outputLanguage: lang.code })}
                      >
                        <Text style={[
                          styles.languageButtonText,
                          { color: theme.text },
                          isActive && styles.languageButtonTextActive,
                        ]}>
                          {lang.nativeLabel}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                {/* Download button — only shown before user initiates download */}
                {!aiSettings.downloadEnabled && !llm.isReady && (
                  <TouchableOpacity
                    style={[styles.downloadButton, { borderColor: colors.primary }]}
                    onPress={() => updateAiSettings({ downloadEnabled: true })}
                  >
                    <Text style={[styles.downloadButtonText, { color: colors.primary }]}>
                      Download Model
                    </Text>
                  </TouchableOpacity>
                )}

                <Text style={[styles.modelHint, { color: theme.textMuted }]}>
                  {aiSettings.downloadEnabled
                    ? 'Once downloaded, AI summaries are available on any article page.'
                    : 'Tap "Download Model" to begin. Wi-Fi recommended. Download may take several minutes.'}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* TTS: uncomment to re-enable Read Aloud section
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Read Aloud (TTS)</Text>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.toggleRow}>
              <View>
                <Text style={[styles.toggleLabel, { color: theme.text }]}>Read Aloud</Text>
                <Text style={[styles.toggleDescription, { color: theme.textMuted }]}>
                  Listen to AI summaries using on-device TTS
                </Text>
              </View>
              <Switch
                value={aiSettings.ttsEnabled}
                onValueChange={(v) => updateAiSettings({ ttsEnabled: v })}
                trackColor={{ false: '#767577', true: colors.primary }}
                thumbColor={aiSettings.ttsEnabled ? colors.white : '#f4f3f4'}
              />
            </View>

            {aiSettings.ttsEnabled && (
              <>
                <Text style={[styles.label, styles.modelLabel, { color: theme.textMuted }]}>
                  Voice
                </Text>
                {TTS_VOICE_OPTIONS.map((voice) => {
                  const isSelected = (aiSettings.ttsVoiceId ?? 'af_heart') === voice.id
                  const isDownloadedLocally = (aiSettings.ttsDownloadedVoiceIds ?? []).includes(voice.id)
                  const isActive = isSelected && tts.isReady
                  const progress = isSelected ? tts.downloadProgress : 0
                  const isDownloading = isSelected && aiSettings.ttsDownloadEnabled && progress > 0 && progress < 1
                  const isPending = isSelected && aiSettings.ttsDownloadEnabled && !isActive && !isDownloading

                  return (
                    <TouchableOpacity
                      key={voice.id}
                      style={[
                        styles.modelRow,
                        { borderColor: theme.border },
                        isSelected && styles.modelRowSelected,
                      ]}
                      onPress={() => updateAiSettings({ ttsVoiceId: voice.id })}
                    >
                      <View style={styles.modelRowContent}>
                        <View style={styles.modelRowLeft}>
                          <View style={[styles.radioCircle, isSelected && { borderColor: colors.primary }]}>
                            {isSelected && <View style={styles.radioFill} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.modelName, { color: theme.text }]}>{voice.label}</Text>
                            <Text style={[styles.modelNote, { color: theme.textMuted }]}>{voice.accent}</Text>
                          </View>
                        </View>

                        <View style={styles.modelStatus}>
                          {isActive && (
                            <View style={[styles.badge, styles.badgeActive]}>
                              <Text style={styles.badgeTextActive}>Active</Text>
                            </View>
                          )}
                          {isDownloading && (
                            <Text style={[styles.modelStatusText, { color: theme.textMuted }]}>
                              {Math.round(progress * 100)}%
                            </Text>
                          )}
                          {isPending && (
                            <Text style={[styles.modelStatusText, { color: theme.textMuted }]}>
                              Loading...
                            </Text>
                          )}
                          {!isActive && !isDownloading && !isPending && (
                            <View style={[
                              styles.badge,
                              isDownloadedLocally ? styles.badgeDownloaded : styles.badgeNotDownloaded,
                            ]}>
                              <Text style={[
                                styles.badgeText,
                                isDownloadedLocally ? styles.badgeTextDownloaded : styles.badgeTextNotDownloaded,
                              ]}>
                                {isDownloadedLocally ? 'Downloaded' : 'Not downloaded'}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  )
                })}

                {!aiSettings.ttsDownloadEnabled && !tts.isReady && (
                  <TouchableOpacity
                    style={[styles.downloadButton, { borderColor: colors.primary }]}
                    onPress={() => updateAiSettings({ ttsDownloadEnabled: true })}
                  >
                    <Text style={[styles.downloadButtonText, { color: colors.primary }]}>
                      Download Voice
                    </Text>
                  </TouchableOpacity>
                )}

                <Text style={[styles.modelHint, { color: theme.textMuted }]}>
                  {aiSettings.ttsDownloadEnabled
                    ? 'Read Aloud is available on English summaries.'
                    : 'Tap "Download Voice" to begin. Works with English output only. Wi-Fi recommended.'}
                </Text>
              </>
            )}
          </View>
        </View>
        */}
      </ScrollView>

      <Spinner
        visible={isLoading}
        overlayColor={colors.loadingSpinnerColor}
      />
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
  label: { fontSize: fontSize.small, color: colors.gray, marginBottom: 4 },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
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
  modelLabel: { marginTop: 16, marginBottom: 8 },
  modelRow: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
    padding: 12,
  },
  modelRowSelected: { borderColor: colors.primary },
  modelRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modelRowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 10,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.gray,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioFill: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  modelName: { fontSize: fontSize.normal, fontWeight: '500', marginBottom: 2 },
  modelNote: { fontSize: fontSize.small, lineHeight: 18, maxWidth: 220 },
  modelStatus: { alignItems: 'flex-end', marginLeft: 8 },
  modelDeleteButton: {
    marginLeft: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.redSecondary,
  },
  modelDeleteButtonText: { fontSize: 11, fontWeight: '600', color: colors.redSecondary },
  modelStatusText: { fontSize: fontSize.small, fontWeight: '600' },
  modelHint: {
    fontSize: fontSize.small,
    lineHeight: 18,
    marginTop: 8,
    fontStyle: 'italic',
  },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeActive: { backgroundColor: colors.primary },
  badgeDownloaded: { backgroundColor: 'rgba(0,180,0,0.12)' },
  badgeNotDownloaded: { backgroundColor: 'rgba(128,128,128,0.12)' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  badgeTextActive: { color: colors.white, fontSize: 11, fontWeight: '600' },
  badgeTextDownloaded: { color: '#00aa00' },
  badgeTextNotDownloaded: { color: colors.gray },
  languageOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  languageButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  languageButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  languageButtonText: { fontSize: fontSize.small, fontWeight: '500' },
  languageButtonTextActive: { color: colors.white },
  downloadButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  downloadButtonText: { fontSize: fontSize.normal, fontWeight: '600' },
})
