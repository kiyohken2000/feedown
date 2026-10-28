import React, { useRef, useContext } from 'react'
import { StyleSheet, useWindowDimensions, View, Text } from "react-native"
import LottieView from "lottie-react-native"
import { colors, fontSize } from '../theme';

export default function ErrorScreen() {
  const animation = useRef(null);
  // Read per render so the size follows window changes (e.g. folding an iPhone Duo).
  const { height, width } = useWindowDimensions()
  
  return (
    <View style={styles.container}>
      <LottieView
        ref={animation}
        source={require("../../assets/lottie/113121-error-404.json")}
        style={{ width: width * 0.3, height: height * 0.3 }}
        autoPlay
      />
      <Text style={[styles.text, {color: colors.black}]}>Network Error</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white
  },
  text: {
    fontSize: fontSize.large
  }
});