import React, { useState, useContext } from "react";
import { createStackNavigator } from '@react-navigation/stack'
import TabNavigator from "../tabs/Tabs";
import Post from "../../../scenes/post/Post";
import { HomeTitleContext } from "../../../contexts/HomeTitleContext";
import { ModalStacks } from "../stacks/ModalStacks";
import { TransitionPresets } from "@react-navigation/stack";

const Stack = createStackNavigator()

export default function RootStack() {
  const [title, setTitle] = useState('default title')

  return (
    <HomeTitleContext.Provider
      value={{
        title,
        setTitle,
      }}
    >
      <HomeTitleContext.Consumer>
        {(ctx) => (
          <Stack.Navigator
            screenOptions={{
              headerShown: false
            }}
          >
            <Stack.Screen
              name='HomeRoot'
              component={TabNavigator}
            />
            <Stack.Group
              screenOptions={{
                presentation: 'modal',
                headerShown: false,
                gestureEnabled: true,
                cardOverlayEnabled: true,
                ...TransitionPresets.ModalPresentationIOS,
              }}
            >
              <Stack.Screen
                name='ModalStack'
                component={ModalStacks}
                options={{
                  title: ctx.title,
                }}
              />
            </Stack.Group>
            <Stack.Group
              screenOptions={{
                presentation: 'modal',
                headerShown: false
              }}
            >
              <Stack.Screen
                name='Post'
                component={Post}
              />
            </Stack.Group>
          </Stack.Navigator>
      )}
      </HomeTitleContext.Consumer>
    </HomeTitleContext.Provider>
  )
}