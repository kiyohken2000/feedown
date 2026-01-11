import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import { navigationProps } from './navigationProps/navigationProps'
import GradientHeader from '../../../components/GradientHeader'

import Profile from '../../../scenes/profile/Profile'
import Details from '../../../scenes/details/Details'

const Stack = createStackNavigator()

export const ProfileStacks = () => {
  return (
    <Stack.Navigator
      initialRouteName="Profile"
      screenOptions={navigationProps}
    >
      <Stack.Screen
        name="Profile"
        component={Profile}
        options={({ navigation }) => ({
          title: 'Profile',
          headerBackground: () => <GradientHeader />,
        })}
      />
      <Stack.Screen
        name="Details"
        component={Details}
        options={{
          title: 'Details',
          headerBackTitleVisible: false,
          headerBackground: () => <GradientHeader />,
        }}
      />
    </Stack.Navigator>
  )
}