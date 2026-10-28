import React, { useRef, useContext } from 'react'
import { StyleSheet, useWindowDimensions, View, Text } from "react-native"
import LottieView from "lottie-react-native"
import { colors, fontSize } from '../theme';

export default function EmptyScreen(props) {
  const animation = useRef(null);
  // Read per render so the size follows window changes (e.g. folding an iPhone Duo).
  const { height, width } = useWindowDimensions()
  const { text } = props
  const label = text?text:'現金残高の登録がありません。'
  
  return (
    <View style={styles.container}>
      <LottieView
        ref={animation}
        source={require("../../assets/lottie/emptyAnimation.json")}
        style={{ width: width * 0.3, height: height * 0.3 }}
        autoPlay
      />
      <Text style={[styles.text, {color: colors.black}]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  text: {
    fontSize: fontSize.large
  }
});