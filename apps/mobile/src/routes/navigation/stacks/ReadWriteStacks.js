import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import { navigationProps } from './navigationProps/navigationProps'

import Read from '../../../scenes/read/Read'

const Stack = createStackNavigator()

export const ReadWriteStacks = () => {
  return (
    <Stack.Navigator
      initialRouteName="Feeds"
      screenOptions={{
        ...navigationProps,
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="Feeds"
        component={Read}
        options={{
          title: 'Feeds',
        }}
      />
    </Stack.Navigator>
  )
}
