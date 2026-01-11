import React from "react";
import { StyleSheet, TouchableOpacity, Text, View, ActivityIndicator } from "react-native";
import { fontSize, colors } from "../theme";

export default function Button(props) {
  const { label, onPress, color, disable, labelColor, labelBold, height, isLoading } = props

  if(isLoading) {
    return (
      <View style={[styles.button, { backgroundColor: color, height: height?height:48 }]}>
        <ActivityIndicator size='small' color={labelColor} />
      </View>
    )
  }

  if(disable) {
    return (
      <View
        style={[styles.button, { backgroundColor: color, opacity: 0.3, height: height?height:48 }]}
      >
        <Text style={[styles.buttonText, { color: labelColor, fontWeight: labelBold?'700':'500' }]}>{label}</Text>
      </View>
    )
  }
  
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: color, height: height?height:48 }]}
      onPress={onPress}
    >
      <Text style={[styles.buttonText, { color: labelColor, fontWeight: labelBold?'700':'500' }]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 5,
    alignItems: "center",
    justifyContent: 'center'
  },
  buttonText: {
    fontSize: fontSize.large
  },
})