import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import { navigationProps } from './navigationProps/navigationProps'
import GradientHeader from '../../../components/GradientHeader'

import SignIn from '../../../scenes/signin/SignIn'
import SignUp from '../../../scenes/signup/SingUp'
import QrScanner from '../../../scenes/signin/QrScanner'

const Stack = createStackNavigator()

export const LoginStacks = () => {
  return (
    <Stack.Navigator
      initialRouteName="SignIn"
      screenOptions={navigationProps}
    >
      <Stack.Screen
        name="SignIn"
        component={SignIn}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SignUp"
        component={SignUp}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="QrScanner"
        component={QrScanner}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  )
}