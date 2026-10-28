import React, { useRef } from 'react'
import { StyleSheet, useWindowDimensions, View } from "react-native"
import LottieView from "lottie-react-native"
import { colors } from '../theme';

export default function LoadingScreen() {
  const animation = useRef(null);
  // Read per render so the size follows window changes (e.g. folding an iPhone Duo).
  const { height, width } = useWindowDimensions()
  
  return (
    <View style={styles.container}>
      <LottieView
        ref={animation}
        source={require("../../assets/lottie/98288-loading.json")}
        style={{ width: width * 0.25, height: height * 0.25 }}
        autoPlay
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white
  }
});