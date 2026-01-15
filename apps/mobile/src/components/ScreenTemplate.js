import React from "react";
import { StyleSheet, StatusBar, View } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, getThemeColors } from "../theme";
import { useTheme } from "../contexts/ThemeContext";
import LoadingScreen from "./LoadingScreen";
import ErrorScreen from "./ErrorScreen";
import EmptyScreen from "./EmptyScreen";

export default function ScreenTemplate(props) {
  const { isLoading, isError, color, isEmpty } = props
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)

  if(isLoading) {
    return <LoadingScreen />
  }

  if(isError) {
    return <ErrorScreen />
  }

  if(isEmpty) {
    return <EmptyScreen />
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['top', 'right', 'left']}
    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.main}>
        {props.children}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  main: {
    flex: 1,
  }
})