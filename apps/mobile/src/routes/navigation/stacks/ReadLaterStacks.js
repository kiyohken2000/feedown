import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import { navigationProps } from './navigationProps/navigationProps'
import ReadLater from '../../../scenes/readlater/ReadLater'
import ArticleDetail from '../../../scenes/article/ArticleDetail'

const Stack = createStackNavigator()

export const ReadLaterStacks = () => {
  return (
    <Stack.Navigator
      initialRouteName="ReadLater"
      screenOptions={{
        ...navigationProps,
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="ReadLater"
        component={ReadLater}
        options={{
          title: 'Read Later',
        }}
      />
      <Stack.Screen
        name="ArticleDetail"
        component={ArticleDetail}
        options={{
          title: 'Article',
        }}
      />
    </Stack.Navigator>
  )
}
