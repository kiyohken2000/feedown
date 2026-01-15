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
import { loginButtonStatus } from '../signin/functions'
import { showToast, showErrorToast } from '../../utils/showToast'

export default function SignUp() {
  const route = useRoute()
  const [serverUrl, setServerUrl] = useState(route.params?.serverUrl || '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { signUp, serverUrl: savedServerUrl } = useContext(UserContext)
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)
  const navigation = useNavigation()

  // Update server URL if passed from SignIn
  useEffect(() => {
    if (route.params?.serverUrl) {
      setServerUrl(route.params.serverUrl)
    } else if (savedServerUrl) {
      setServerUrl(savedServerUrl)
    }
  }, [route.params?.serverUrl, savedServerUrl])

  const onSignUpPress = async () => {
    if (!serverUrl.trim()) {
      showErrorToast({
        title: 'Server URL Required',
        body: 'Please enter your server URL',
      })
      return
    }

    try {
      setIsLoading(true)
      await signUp(email, password, serverUrl.trim())
      showToast({
        title: 'Account Created',
        body: 'Welcome to FeedOwn!',
      })
      // Navigation is handled automatically by UserContext
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

  const onQuickCreatePress = async () => {
    try {
      setIsLoading(true)
      const randomNum = Math.floor(Math.random() * 1000000)
      const testEmail = `test-${randomNum}@test.com`
      const testPassword = '111111'
      const testServerUrl = 'https://feedown.pages.dev'

      await signUp(testEmail, testPassword, testServerUrl)
      showToast({
        title: 'Test Account Created',
        body: `Email: ${testEmail}`,
      })
    } catch (e) {
      console.log('on quick create error', e)
      showErrorToast({
        title: 'Quick Create Failed',
        body: e.message || 'Please try again',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ScreenTemplate>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={styles.headerTitle}>Create Account</Text>
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

          {/* Divider */}
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <Text style={[styles.dividerText, { color: theme.textMuted }]}>OR</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          {/* Quick Create Test Account */}
          <View style={styles.element}>
            <Button
              label="Quick Create Test Account"
              onPress={onQuickCreatePress}
              color="#3b82f6"
              disable={false}
              labelColor={colors.white}
              labelBold={false}
              isLoading={isLoading}
            />
          </View>
          <View style={[styles.noticeBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
              Test accounts are limited to 3 feeds and 10 favorites.
            </Text>
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.grayLight,
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: fontSize.small,
    color: colors.gray,
  },
  noticeBox: {
    marginHorizontal: 10,
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.grayLight,
  },
  noticeText: {
    fontSize: fontSize.small,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 18,
  },
})
