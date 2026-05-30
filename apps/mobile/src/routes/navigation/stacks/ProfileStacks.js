import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import { navigationProps } from './navigationProps/navigationProps'

import Profile from '../../../scenes/profile/Profile'
import AiSettings from '../../../scenes/profile/AiSettings'

const Stack = createStackNavigator()

export const ProfileStacks = () => {
  return (
    <Stack.Navigator
      initialRouteName="Profile"
      screenOptions={{
        ...navigationProps,
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="Profile"
        component={Profile}
        options={{
          title: 'Settings',
        }}
      />
      <Stack.Screen
        name="AiSettings"
        component={AiSettings}
        options={{
          title: 'On-Device AI',
        }}
      />
    </Stack.Navigator>
  )
}
