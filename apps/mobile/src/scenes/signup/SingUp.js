import React, { useContext, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Button from '../../components/Button'
import { colors } from '../../theme'
import { useNavigation } from '@react-navigation/native'
import { UserContext } from '../../contexts/UserContext'
import ScreenTemplate from '../../components/ScreenTemplate'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import Logo from '../../components/Logo'
import TextInputBox from '../../components/TextInputBox'
import { loginButtonStatus } from '../signin/functions'
import { showToast, showErrorToast } from '../../utils/showToast'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { signUp } = useContext(UserContext)
  const navigation = useNavigation()

  const onSignUpPress = async () => {
    try {
      setIsLoading(true)
      await signUp(email, password)
      showToast({
        title: 'Account Created',
        body: 'Please check your email to verify your account',
      })
      // Supabase will handle auto-login after signup
    } catch (e) {
      console.log('on sign up error', e)
      showErrorToast({
        title: 'Sign Up Failed',
        body: e.message || 'Please try again',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ScreenTemplate>
      <KeyboardAwareScrollView style={styles.container}>
        <Logo />
        <View style={styles.element}>
          <TextInputBox
            placeholder="E-mail"
            onChangeText={(text) => setEmail(text)}
            autoCapitalize="none"
            value={email}
            keyboardType="email-address"
          />
        </View>
        <View style={styles.element}>
          <TextInputBox
            secureTextEntry={true}
            placeholder="Password (min 6 characters)"
            onChangeText={(text) => setPassword(text)}
            value={password}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.element}>
          <Button
            label="Sign Up"
            onPress={onSignUpPress}
            color={colors.bluePrimary}
            disable={!loginButtonStatus({ email, password })}
            labelColor={colors.white}
            labelBold={false}
            isLoading={isLoading}
          />
        </View>
        <View style={styles.element}>
          <Button
            label="Go Back"
            onPress={() => navigation.goBack()}
            color={colors.blueSecondary}
            disable={false}
            labelColor={colors.white}
            labelBold={false}
            isLoading={false}
          />
        </View>
      </KeyboardAwareScrollView>
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  element: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  }
})