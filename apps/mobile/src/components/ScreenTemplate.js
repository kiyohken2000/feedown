import React, { useEffect, useState, useCallback } from "react";
import { StyleSheet, StatusBar, View } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from "../theme";
import LoadingScreen from "./LoadingScreen";
import ErrorScreen from "./ErrorScreen";
import EmptyScreen from "./EmptyScreen";

export default function ScreenTemplate(props) {
  const { isLoading, isError, color, isEmpty } = props

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
      style={styles.container}
      edges={['top', 'right', 'bottom', 'left']}
    >
      <StatusBar barStyle='dark-content' />
      <View style={styles.main}>
        {props.children}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white
  },
  main: {
    flex: 1,
  }
})