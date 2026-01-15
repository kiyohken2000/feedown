import React, { useEffect, useContext } from 'react'
import { useDispatch } from 'react-redux'
import { authenticate } from 'slices/app.slice'
import { Text, StyleSheet, ActivityIndicator, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { UserContext } from '../../contexts/UserContext'
import { fontSize, colors } from 'theme'

export default function Loading() {
  const dispatch = useDispatch()
  const { isLoading } = useContext(UserContext)

  useEffect(() => {
    // Wait for auth state to be determined
    if (!isLoading) {
      dispatch(authenticate({ checked: true }))
    }
  }, [isLoading])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.label}>FeedOwn</Text>
        <ActivityIndicator
          size="large"
          color={colors.bluePrimary}
          style={styles.spinner}
        />
        <Text style={styles.subLabel}>Loading...</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  content: {
    alignItems: 'center',
  },
  label: {
    fontSize: fontSize.xxxLarge,
    fontWeight: '700',
    color: colors.bluePrimary,
    marginBottom: 20,
  },
  spinner: {
    marginVertical: 20,
  },
  subLabel: {
    fontSize: fontSize.middle,
    color: colors.gray,
  },
})