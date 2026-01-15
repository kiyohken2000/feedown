import React, { useContext } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { UserContext } from '../../contexts/UserContext'
import { useTheme } from '../../contexts/ThemeContext'
import { NavigationContainer } from '@react-navigation/native'
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

export default function Navigation() {
  const { user } = useContext(UserContext)
  return (
    <>
    <NavigationContainer>
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
