import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, fontSize } from '../../theme'
import ScreenTemplate from '../../components/ScreenTemplate'

export default function Read() {

  return (
    <ScreenTemplate>
      <View style={styles.root}>
        <Text style={styles.title}>Read Screen</Text>
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
    marginBottom: 20,
  },
})
