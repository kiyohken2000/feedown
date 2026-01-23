import React, { useContext, useState, useEffect } from 'react'
import { StyleSheet, View, Text, Image } from 'react-native'
import Button from '../../components/Button'
import { colors, fontSize, getThemeColors } from '../../theme'
import { useNavigation, useRoute } from '@react-navigation/native'
import { UserContext } from '../../contexts/UserContext'
import { useTheme } from '../../contexts/ThemeContext'
import ScreenTemplate from '../../components/ScreenTemplate'
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'
import TextInputBox from '../../components/TextInputBox'
import { loginButtonStatus } from './functions'
import { showErrorToast } from '../../utils/showToast'

export default function SignIn() {
  const [serverUrl, setServerUrl] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { signIn, serverUrl: savedServerUrl } = useContext(UserContext)
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)
  const navigation = useNavigation()
  const route = useRoute()

  // Load saved server URL on mount
  useEffect(() => {
    if (savedServerUrl) {
      setServerUrl(savedServerUrl)
    }
  }, [savedServerUrl])

  // Handle QR scan data
  useEffect(() => {
    if (route.params?.qrServerUrl) {
      setServerUrl(route.params.qrServerUrl)
    }
    if (route.params?.qrEmail) {
      setEmail(route.params.qrEmail)
    }
  }, [route.params])

  const onSignInPress = async () => {
    if (!serverUrl.trim()) {
      showErrorToast({
        title: 'Server URL Required',
        body: 'Please enter your server URL',
      })
      return
    }

    try {
      setIsLoading(true)
      await signIn(email, password, serverUrl.trim())
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
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={styles.headerTitle}>FeedOwn</Text>
      </View>
      <KeyboardAwareScrollView style={styles.container}>
        <Image
          style={styles.logo}
          source={require('../../../assets/images/logo-lg.png')}
        />
        <View style={styles.formContainer}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Server</Text>
          <View style={styles.element}>
            <TextInputBox
              placeholder="https://your-server.pages.dev"
              onChangeText={(text) => setServerUrl(text)}
              autoCapitalize="none"
              value={serverUrl}
              keyboardType="url"
              autoCorrect={false}
            />
          </View>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Enter your FeedOwn server URL (e.g. https://feedown.pages.dev)
          </Text>

          <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 24 }]}>Account</Text>
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
              onPress={() => navigation.navigate('SignUp', { serverUrl })}
              color={colors.blueSecondary}
              disable={false}
              labelColor={colors.white}
              labelBold={false}
              isLoading={false}
            />
          </View>
          <View style={styles.element}>
            <Button
              label="Scan QR Code"
              onPress={() => navigation.navigate('QrScanner')}
              color={colors.primary}
              disable={false}
              labelColor={colors.white}
              labelBold={false}
              isLoading={false}
            />
          </View>
        </View>
      </KeyboardAwareScrollView>
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  headerTitle: {
    fontSize: fontSize.xxLarge,
    fontWeight: 'bold',
    color: colors.primary,
  },
  container: {
    flex: 1,
  },
  logo: {
    height: 120,
    width: 120,
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 10,
    borderRadius: 20,
  },
  formContainer: {
    paddingTop: 8,
  },
  sectionLabel: {
    fontSize: fontSize.normal,
    fontWeight: '600',
    color: colors.gray,
    marginBottom: 8,
    paddingHorizontal: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  element: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  hint: {
    fontSize: fontSize.small,
    color: colors.gray,
    paddingHorizontal: 10,
    lineHeight: 18,
  },
})
