/**
 * A feed's favicon, or its first letter on a colored square when there is no
 * favicon or it fails to load (e.g. Google's favicon service answers 404 for
 * a host without an icon).
 */
import React, { useEffect, useState } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme'

export default function FeedIcon({ uri, title, size = 16, radius, style }) {
  const [failed, setFailed] = useState(false)
  // A different feed in a recycled row gets a fresh try
  useEffect(() => setFailed(false), [uri])

  const box = { width: size, height: size, borderRadius: radius ?? Math.round(size / 6) }
  if (uri && !failed) {
    return <Image source={{ uri }} style={[box, style]} onError={() => setFailed(true)} />
  }
  const letter = (title || '').trim().charAt(0).toUpperCase() || 'F'
  return (
    <View style={[styles.placeholder, box, style]} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={[styles.letter, { fontSize: Math.max(8, Math.round(size * 0.6)) }]} allowFontScaling={false}>
        {letter}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    color: colors.white,
    fontWeight: 'bold',
  },
})
