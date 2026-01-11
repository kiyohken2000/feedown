import React, { useEffect, useContext } from 'react'
import { useDispatch } from 'react-redux'
import { authenticate } from 'slices/app.slice'
import { Text, StyleSheet } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserContext } from '../../contexts/UserContext';
import { fontSize } from 'theme'
import { dummyUser, isAutoLogin } from '../../config';

export default function Loading() {
  const dispatch = useDispatch()
  const { setUser } = useContext(UserContext)

  useEffect(() => {
    initialize()
  }, [])

  const initialize = async() => {
    if(isAutoLogin) {
      setUser(dummyUser)
      dispatch(authenticate({ checked: true }))
    } else {
      dispatch(authenticate({ checked: true }))
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.label}>Loaging</Text>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  label: {
    fontSize: fontSize.xxxLarge,
    fontWeight: '700'
  }
})