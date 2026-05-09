import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio'
import { colors, fontSize } from '../../theme'
import { summaryToSpeakableText, writeTempWav } from '../../ai/ttsService'

const SPEEDS = [0.75, 1.0, 1.25, 1.5]

export default function ArticleReadAloudControls({ result, tts, theme }) {
  const [speed, setSpeed] = useState(1.0)
  const [isLoading, setIsLoading] = useState(false)
  const [ttsError, setTtsError] = useState(null)
  const generatedSpeedRef = useRef(null)

  const player = useAudioPlayer(null)
  const status = useAudioPlayerStatus(player)
  const isPlaying = status?.playing ?? false
  const isLoaded = status?.isLoaded ?? false

  // Seek to beginning when finished
  useEffect(() => {
    if (status?.didJustFinish) {
      player.seekTo(0)
    }
  }, [status?.didJustFinish]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePress = useCallback(async () => {
    if (tts.isGenerating || isLoading) return

    if (isPlaying) {
      player.pause()
      return
    }

    // If audio is already loaded at the same speed, just resume/replay
    if (isLoaded && generatedSpeedRef.current === speed) {
      player.play()
      return
    }

    // Generate fresh audio
    setIsLoading(true)
    setTtsError(null)
    try {
      await setAudioModeAsync({ playsInSilentMode: true })
      const text = summaryToSpeakableText(result)
      if (!text) return
      const samples = await tts.forward({ text, speed })
      const uri = await writeTempWav(samples)
      player.replace({ uri })
      player.play()
      generatedSpeedRef.current = speed
    } catch (e) {
      console.error('TTS error:', e)
      setTtsError('Could not generate audio')
    } finally {
      setIsLoading(false)
    }
  }, [tts, isLoading, isPlaying, isLoaded, speed, result, player])

  // Invalidate cached audio when result changes
  useEffect(() => {
    generatedSpeedRef.current = null
    if (isPlaying) player.pause()
  }, [result]) // eslint-disable-line react-hooks/exhaustive-deps

  const isbusy = isLoading || tts.isGenerating

  const btnLabel = isbusy ? null : isPlaying ? '⏸' : '▶ Read'

  return (
    <View style={[styles.container, { borderTopColor: theme.border }]}>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.playBtn, { borderColor: isPlaying ? theme.border : colors.primary }]}
          onPress={handlePress}
          activeOpacity={0.7}
          disabled={isbusy}
        >
          {isbusy ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.playBtnText, { color: isPlaying ? theme.textMuted : colors.primary }]}>
              {btnLabel}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.speedRow}>
          {SPEEDS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.speedBtn,
                { borderColor: theme.border },
                speed === s && styles.speedBtnActive,
              ]}
              onPress={() => setSpeed(s)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.speedText,
                { color: speed === s ? colors.white : theme.textMuted },
              ]}>
                {s === 1.0 ? '1×' : `${s}×`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {ttsError && (
        <Text style={[styles.errorText, { color: colors.redSecondary }]}>{ttsError}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    height: 34,
  },
  playBtnText: {
    fontSize: fontSize.small,
    fontWeight: '600',
  },
  speedRow: {
    flexDirection: 'row',
    gap: 6,
  },
  speedBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  speedBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  speedText: {
    fontSize: 11,
    fontWeight: '600',
  },
  errorText: {
    fontSize: fontSize.small,
    marginTop: 6,
  },
})
