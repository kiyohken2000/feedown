import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, fontSize } from '../../theme'
import ScreenTemplate from '../../components/ScreenTemplate'

export default function Write() {

  return (
    <ScreenTemplate>
      <View style={styles.root}>
        <Text style={styles.title}>Write Screen</Text>
      </View>
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lightGrayPurple,
  },
  title: {
    fontSize: fontSize.xxxLarge,
  },
})
