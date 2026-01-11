import React, { useContext } from 'react'
import { createStackNavigator } from '@react-navigation/stack'

import Read from '../../../../scenes/read/Read'

const Stack = createStackNavigator()

export const ReadStacks = () => {
  return (
    <Stack.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: false,
      })}
    >
      <Stack.Screen
        name="Read"
        component={Read}
      />
    </Stack.Navigator>
  )
}