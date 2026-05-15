import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, fontSize, getThemeColors } from '../theme'
import { useTheme } from '../contexts/ThemeContext'

export default function ConnectionHintBox() {
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)

  return (
    <View
      style={[
        styles.box,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.title, { color: theme.textSecondary }]}>
        {'⚠  Connection issue'}
      </Text>
      <Text style={[styles.body, { color: theme.textMuted }]}>
        If sign-in keeps failing, try one of these:
      </Text>
      <Text style={[styles.bullet, { color: theme.textMuted }]}>
        {'•  Disable VPN if enabled'}
      </Text>
      <Text style={[styles.bullet, { color: theme.textMuted }]}>
        {'•  Switch between Wi-Fi and cellular'}
      </Text>
      <Text style={[styles.bullet, { color: theme.textMuted }]}>
        {'•  Try again in a moment'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    marginHorizontal: 10,
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.grayLight,
  },
  title: {
    fontSize: fontSize.normal,
    fontWeight: '600',
    marginBottom: 6,
  },
  body: {
    fontSize: fontSize.small,
    lineHeight: 18,
    marginBottom: 4,
  },
  bullet: {
    fontSize: fontSize.small,
    lineHeight: 20,
    paddingLeft: 4,
  },
})
