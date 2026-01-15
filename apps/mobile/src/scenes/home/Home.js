import React, { useContext, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Button from '../../components/Button'
import { colors, fontSize } from '../../theme'
import { useNavigation } from '@react-navigation/native'
import { UserContext } from '../../contexts/UserContext'
import ScreenTemplate from '../../components/ScreenTemplate'
import { showToast, showErrorToast } from '../../utils/showToast'
import Spinner from 'react-native-loading-spinner-overlay'
import BlurBox from '../../components/BlurBox/BlurBox'

export default function Home() {
  const navigation = useNavigation()
  const { user, signOut } = useContext(UserContext)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    console.log('user:', user?.email)
  }, [])

  const onToastPress = () => {
    showToast({ title: 'Hello', body: 'React Native Developer' })
  }

  const onSignOutPress = async () => {
    try {
      setIsLoading(true)
      await signOut()
      showToast({ title: 'Signed Out', body: 'See you next time!' })
    } catch (e) {
      console.log('sign out error', e)
      showErrorToast({ title: 'Error', body: e.message })
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <ScreenTemplate>
      <BlurBox>
      <View style={styles.root}>
        <Text style={styles.title}>Home</Text>
        <View style={styles.textContainer}>
          <Text>ヘッダーなしボトムタブあり</Text>
        </View>
        <View style={styles.buttonContainer}>
          <Button
            label="Go to Details"
            color={colors.darkPurple}
            disable={false}
            labelColor={colors.white}
            onPress={() => {
              navigation.navigate('Details', { from: 'Home' })
            }}
          />
          <View style={{marginVertical: 10}} />
          <Button
            label="Go to Modal"
            color={colors.bluePrimary}
            labelColor={colors.white}
            disable={false}
            onPress={() => {
              navigation.navigate('ModalStack', {
                screen: 'Modal',
                params: {from: 'Home'}
              })
            }}
          />
          <View style={{marginVertical: 10}} />
          <Button
            label="Go to Modal"
            color={colors.lightPurple}
            labelColor={colors.white}
            disable={false}
            onPress={() => {
              navigation.navigate('Post')
            }}
          />
          <View style={{marginVertical: 10}} />
          <Button
            label="Go to Modal"
            color={colors.lightPurple}
            labelColor={colors.white}
            disable={false}
            onPress={() => {
              navigation.navigate('Menu')
            }}
          />
          <View style={{marginVertical: 10}} />
          <Button
            label="Show Toast"
            color={colors.lightPurple}
            labelColor={colors.white}
            disable={false}
            onPress={onToastPress}
          />
          <View style={{marginVertical: 10}} />
          <Button
            label="Sign out"
            color={colors.lightPurple}
            labelColor={colors.white}
            disable={false}
            onPress={onSignOutPress}
          />
        </View>
      </View>
      </BlurBox>
      <Spinner
        visible={isLoading}
        overlayColor={colors.loadingSpinnerColor}
      />
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.xxxLarge,
    marginBottom: 20,
  },
  textContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 10
  }
})
