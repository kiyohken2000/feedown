import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import FontIcon from 'react-native-vector-icons/FontAwesome'
import { colors } from 'theme'

// stack navigators
import { HomeStacks } from '../stacks/HomeStacks'
import { ProfileStacks } from '../stacks/ProfileStacks'
import { ReadWriteStacks } from '../stacks/ReadWriteStacks'

const Tab = createBottomTabNavigator()

export default function TabNavigator() {
  return (
    <Tab.Navigator
      options={{
        tabBarActiveTintColor: colors.lightPurple,
        tabBarInactiveTintColor: colors.gray,
        tabBarStyle: {
          // backgroundColor: 'white',
          // borderTopColor: 'gray',
          // borderTopWidth: 1,
          // paddingBottom: 5,
          // paddingTop: 5,
        }
      }}
      defaultScreenOptions={{
        headerShown:false,
        headerTransparent:true
      }}
      screenOptions={({ route }) => ({
        headerShown: false,
      })}
      initialRouteName="HomeTab"
      swipeEnabled={false}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStacks}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <FontIcon
              name="home"
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
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <FontIcon
              name="user"
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
          tabBarLabel: 'R/W',
          tabBarIcon: ({ color, size }) => (
            <FontIcon
              name="address-card"
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tab.Navigator>
  )
}
