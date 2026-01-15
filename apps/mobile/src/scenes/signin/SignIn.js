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
import { loginButtonStatus } from './functions'
import { showErrorToast } from '../../utils/showToast'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { signIn } = useContext(UserContext)
  const navigation = useNavigation()

  const onSignInPress = async () => {
    try {
      setIsLoading(true)
      await signIn(email, password)
      // Navigation is handled automatically by UserContext
    } catch (e) {
      console.log('on sign in error', e)
      showErrorToast({
        title: 'Sign In Failed',
        body: e.message || 'Please check your credentials',
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
            placeholder="Password"
            onChangeText={(text) => setPassword(text)}
            value={password}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.element}>
          <Button
            label="Sign in"
            onPress={onSignInPress}
            color={colors.bluePrimary}
            disable={!loginButtonStatus({ email, password })}
            labelColor={colors.white}
            labelBold={false}
            isLoading={isLoading}
          />
        </View>
        <View style={styles.element}>
          <Button
            label="Sign Up"
            onPress={() => navigation.navigate('SignUp')}
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