import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import { navigationProps } from './navigationProps/navigationProps'

import Favorites from '../../../scenes/favorites/Favorites'
import ArticleDetail from '../../../scenes/article/ArticleDetail'

const Stack = createStackNavigator()

export const FavoritesStacks = () => {
  return (
    <Stack.Navigator
      initialRouteName="Favorites"
      screenOptions={{
        ...navigationProps,
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="Favorites"
        component={Favorites}
        options={{
          title: 'Favorites',
        }}
      />
      <Stack.Screen
        name="FavoriteDetail"
        component={ArticleDetail}
        options={{
          title: 'Article',
        }}
      />
    </Stack.Navigator>
  )
}
