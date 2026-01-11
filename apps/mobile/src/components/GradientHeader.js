import React from 'react'
import { LinearGradient } from 'expo-linear-gradient'
import { colors } from '../theme'

export default function GradientHeader() {
  return (
    <LinearGradient
      colors={[colors.darkPurple, colors.blueSecondary]}
      style={{ flex: 1 }}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 0}}
    />
  )
}
