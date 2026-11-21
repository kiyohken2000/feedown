import React, { useContext, useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { UserContext } from '../../contexts/UserContext'
import { useTheme } from '../../contexts/ThemeContext'
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native'
import * as Notifications from 'expo-notifications'
import { NEW_ARTICLES_NOTIFICATION_TYPE } from '../../utils/backgroundRefresh'
// import DrawerNavigator from './drawer'
import RootStack from './rootStack/RootStack'
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message'
import { LoginStacks } from './stacks/LoginStacks'
import { colors, getThemeColors } from '../../theme'

function ToastWrapper() {
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)

  const toastConfig = {
    success: (props) => (
      <BaseToast
        {...props}
        style={{
          borderLeftColor: colors.primary,
          backgroundColor: theme.card,
        }}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        text1Style={{
          fontSize: 15,
          fontWeight: '600',
          color: theme.text,
        }}
        text2Style={{
          fontSize: 13,
          color: theme.textSecondary,
        }}
      />
    ),
    error: (props) => (
      <ErrorToast
        {...props}
        style={{
          borderLeftColor: colors.redSecondary,
          backgroundColor: theme.card,
        }}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        text1Style={{
          fontSize: 15,
          fontWeight: '600',
          color: theme.text,
        }}
        text2Style={{
          fontSize: 13,
          color: theme.textSecondary,
        }}
      />
    ),
  }

  return <Toast config={toastConfig} />
}

// Tapping a "new articles" notification opens the article list. The list
// itself is reloaded by FeedsContext when the app comes to the foreground.
function useNewArticlesNotificationTap(navRef, navReady, signedIn) {
  useEffect(() => {
    if (!navReady || !signedIn) return undefined
    const handle = (response) => {
      const type = response?.notification?.request?.content?.data?.type
      if (type !== NEW_ARTICLES_NOTIFICATION_TYPE || !navRef.isReady()) return
      navRef.navigate('HomeRoot', { screen: 'HomeTab', params: { screen: 'Home' } })
    }
    const sub = Notifications.addNotificationResponseReceivedListener(handle)
    // The notification that launched the app, if any
    Notifications.getLastNotificationResponseAsync()
      .then(async (response) => {
        if (!response) return
        await Notifications.clearLastNotificationResponseAsync()
        handle(response)
      })
      .catch((e) => console.warn(`[bg-refresh] failed to read launch notification: ${e?.message || e}`))
    return () => sub.remove()
  }, [navRef, navReady, signedIn])
}

export default function Navigation() {
  const { user } = useContext(UserContext)
  const navRef = useNavigationContainerRef()
  const [navReady, setNavReady] = useState(false)
  useNewArticlesNotificationTap(navRef, navReady, !!user)
  return (
    <>
    <NavigationContainer ref={navRef} onReady={() => setNavReady(true)}>
      {user?
        <RootStack />
        :
        <LoginStacks/>
      }
    </NavigationContainer>
    <ToastWrapper />
    </>
  )
}
