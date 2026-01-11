import React from 'react'
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs'
import { screenOptions } from './navigationProps/navigationProps'

import { WriteStacks } from '../stacks/toptabstacks/WriteStacks'
import { ReadStacks } from '../stacks/toptabstacks/ReadStacks'

const Tab = createMaterialTopTabNavigator()

export const ReadWriteTopTabs = () => {
  return (
    <Tab.Navigator
      initialRouteName="WriteTab"
      screenOptions={screenOptions}
    >
      <Tab.Screen
        name="WriteTab"
        component={WriteStacks}
        options={{ tabBarLabel: 'Write' }}
      />
      <Tab.Screen
        name="ReadTab"
        component={ReadStacks}
        options={{ tabBarLabel: 'Read' }}
      />
    </Tab.Navigator>
  )
}