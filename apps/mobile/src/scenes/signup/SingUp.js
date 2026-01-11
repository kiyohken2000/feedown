import React, { useContext, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Button from '../../components/Button'
import { colors, fontSize } from '../../theme'
import { useNavigation } from '@react-navigation/native'
import { UserContext } from '../../contexts/UserContext'
import ScreenTemplate from '../../components/ScreenTemplate'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import Logo from '../../components/Logo'
import { sleep } from '../../utils/utilFunctions'
import { dummyUser } from '../../config'
import TextInputBox from '../../components/TextInputBox'
import { loginButtonStatus } from '../signin/functions'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { setUser } = useContext(UserContext)
  const navigation = useNavigation()

  const onSignUpPress = async() => {
    try {
      setIsLoading(true)
      await sleep(3000)
      const user = {
        id: dummyUser.id,
        userName: email
      }
      setUser(user)
    } catch(e) {
      console.log('on sign in error', e)
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
            placeholder='E-mail'
            onChangeText={(text) => setEmail(text)}
            autoCapitalize="none"
            value={email}
            keyboardType={'email-address'}
            maxLength={12}
          />
        </View>
        <View style={styles.element}>
          <TextInputBox
            secureTextEntry={true}
            placeholder='Password'
            onChangeText={(text) => setPassword(text)}
            value={password}
            autoCapitalize="none"
            maxLength={12}
          />
        </View>
        <View style={styles.element}>
          <Button
            label='Sign Up'
            onPress={onSignUpPress}
            color={colors.bluePrimary}
            disable={!loginButtonStatus({email, password})}
            labelColor={colors.white}
            labelBold={false}
            isLoading={isLoading}
          />
        </View>
        <View style={styles.element}>
          <Button
            label='Go Back'
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