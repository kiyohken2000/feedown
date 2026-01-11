import React, { useState, useContext } from "react";
import { createStackNavigator } from '@react-navigation/stack'
import { HomeTitleContext } from "../../../contexts/HomeTitleContext";

import Modal from '../../../scenes/modal/Modal'
import Print from '../../../scenes/print/Print'

const Stack = createStackNavigator()

export const ModalStacks = () => {
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
              headerShown: true,
            }}
          >
            <Stack.Screen
              name='Modal'
              component={Modal}
              options={{
                title: ctx.title,
                headerBackTitleVisible: false,
              }}
            />
            <Stack.Screen
              name='Print'
              component={Print}
              options={{
                headerBackTitleVisible: false,
              }}
            />
          </Stack.Navigator>
      )}
      </HomeTitleContext.Consumer>
    </HomeTitleContext.Provider>
  )
}