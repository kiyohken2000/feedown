import React, { useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { colors, fontSize } from '../../theme'
// import ArticleReadAloudControls from './ArticleReadAloudControls'  // TTS: uncomment to re-enable

export default function PerspectiveSummaryView({
  result,
  isGenerating,
  error,
  onGenerate,
  onInterrupt,
  theme,
  tts,
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!result) return
    const text = result.summary.join('\n')
    await Clipboard.setStringAsync(text)
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isGenerating) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.stateText, { color: theme.textSecondary }]}>
          Generating summary...
        </Text>
        <TouchableOpacity style={styles.interruptButton} onPress={onInterrupt}>
          <Text style={styles.interruptButtonText}>Stop</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.stateContainer}>
        <Text style={[styles.errorText, { color: colors.redSecondary }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.generateButton, { borderColor: colors.primary }]}
          onPress={onGenerate}
        >
          <Text style={[styles.generateButtonText, { color: colors.primary }]}>
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!result) {
    return (
      <View style={styles.stateContainer}>
        <Text style={[styles.stateText, { color: theme.textMuted }]}>
          AI will summarize the key points of this article
        </Text>
        <TouchableOpacity
          style={[styles.generateButton, { borderColor: colors.primary }]}
          onPress={onGenerate}
        >
          <Text style={[styles.generateButtonText, { color: colors.primary }]}>
            Generate Summary
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View>
      {result.summary.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
          <Text style={[styles.bulletText, { color: theme.text }]}>{item}</Text>
        </View>
      ))}

      {result.caveats && result.caveats.length > 0 && (
        <View style={[styles.caveatsBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.caveatsLabel, { color: theme.textMuted }]}>Note</Text>
          {result.caveats.map((c, i) => (
            <Text key={i} style={[styles.caveatsText, { color: theme.textSecondary }]}>
              {c}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.bottomRow}>
        <TouchableOpacity style={styles.regenerateRow} onPress={() => onGenerate({ force: true })}>
          <Text style={[styles.regenerateText, { color: theme.textMuted }]}>Regenerate</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
          <Text style={[styles.copyButtonText, { color: copied ? colors.primary : theme.textMuted }]}>
            {copied ? 'Copied!' : 'Copy'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* TTS: uncomment to re-enable
      {tts?.isReady && (
        <ArticleReadAloudControls result={result} tts={tts} theme={theme} />
      )} */}
    </View>
  )
}

const styles = StyleSheet.create({
  stateContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  stateText: {
    fontSize: fontSize.normal,
    textAlign: 'center',
  },
  errorText: {
    fontSize: fontSize.normal,
    textAlign: 'center',
  },
  generateButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  generateButtonText: {
    fontSize: fontSize.normal,
    fontWeight: '600',
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingRight: 4,
  },
  bullet: {
    fontSize: fontSize.large,
    lineHeight: 24,
    marginRight: 8,
    marginTop: 1,
  },
  bulletText: {
    flex: 1,
    fontSize: fontSize.normal,
    lineHeight: 24,
  },
  caveatsBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  caveatsLabel: {
    fontSize: fontSize.small,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  caveatsText: {
    fontSize: fontSize.small,
    lineHeight: 20,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  regenerateRow: {
    paddingVertical: 4,
  },
  regenerateText: {
    fontSize: fontSize.small,
  },
  copyButton: {
    paddingVertical: 4,
    paddingLeft: 16,
  },
  copyButtonText: {
    fontSize: fontSize.small,
    fontWeight: '600',
  },
  interruptButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.redSecondary,
  },
  interruptButtonText: {
    fontSize: fontSize.small,
    color: colors.redSecondary,
    fontWeight: '600',
  },
})
