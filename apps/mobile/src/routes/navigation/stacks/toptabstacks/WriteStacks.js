import React, { useContext } from 'react'
import { createStackNavigator } from '@react-navigation/stack'

import Write from '../../../../scenes/write/Write'

const Stack = createStackNavigator()

export const WriteStacks = () => {
  return (
    <Stack.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: false,
      })}
    >
      <Stack.Screen
        name="Write"
        component={Write}
      />
    </Stack.Navigator>
  )
}