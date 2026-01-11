import React, { useRef, useContext } from 'react'
import { StyleSheet, Dimensions, View, Text } from "react-native"
import LottieView from "lottie-react-native"
import { colors, fontSize } from '../theme';

export default function EmptyScreen(props) {
  const animation = useRef(null);
  const { text } = props
  const label = text?text:'現金残高の登録がありません。'
  
  return (
    <View style={styles.container}>
      <LottieView
        ref={animation}
        source={require("../../assets/lottie/emptyAnimation.json")}
        style={styles.animation}
        autoPlay
      />
      <Text style={[styles.text, {color: colors.black}]}>{label}</Text>
    </View>
  )
}

const { height, width } = Dimensions.get('window')
const styles = StyleSheet.create({
  animation: {
    width: width * 0.3,
    height: height * 0.3,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  text: {
    fontSize: fontSize.large
  }
});