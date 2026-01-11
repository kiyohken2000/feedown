import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import { navigationProps } from './navigationProps/navigationProps'
import GradientHeader from '../../../components/GradientHeader'

import SignIn from '../../../scenes/signin/SignIn'
import SignUp from '../../../scenes/signup/SingUp'

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
        options={({ navigation }) => ({
          title: 'SignIn',
          headerShown: true,
          headerBackTitleVisible: false,
          headerBackground: () => <GradientHeader />,
        })}
      />
      <Stack.Screen
        name="SignUp"
        component={SignUp}
        options={({ navigation }) => ({
          title: 'SignUp',
          headerShown: true,
          headerBackTitleVisible: false,
          headerBackground: () => <GradientHeader />,
        })}
      />
    </Stack.Navigator>
  )
}