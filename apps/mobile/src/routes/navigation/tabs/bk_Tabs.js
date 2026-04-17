import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import FontIcon from 'react-native-vector-icons/FontAwesome'
import { colors, getThemeColors } from 'theme'
import { useTheme } from '../../../contexts/ThemeContext'

// stack navigators
import { HomeStacks } from '../stacks/HomeStacks'
import { FavoritesStacks } from '../stacks/FavoritesStacks'
import { ProfileStacks } from '../stacks/ProfileStacks'
import { ReadWriteStacks } from '../stacks/ReadWriteStacks'

const Tab = createBottomTabNavigator()

export default function TabNavigator() {
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.tabBarBackground,
          borderTopColor: theme.tabBarBorder,
          borderTopWidth: 1,
          paddingBottom: 5,
          paddingTop: 5,
        },
      })}
      initialRouteName="HomeTab"
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStacks}
        options={{
          tabBarLabel: 'Articles',
          tabBarIcon: ({ color, size }) => (
            <FontIcon
              name="newspaper-o"
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tab.Screen
        name="FavoritesTab"
        component={FavoritesStacks}
        options={{
          tabBarLabel: 'Favorites',
          tabBarIcon: ({ color, size }) => (
            <FontIcon
              name="star"
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tab.Screen
        name="ReadWriteTab"
        component={ReadWriteStacks}
        options={{
          tabBarLabel: 'Feeds',
          tabBarIcon: ({ color, size }) => (
            <FontIcon
              name="rss"
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStacks}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <FontIcon
              name="cog"
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tab.Navigator>
  )
}
