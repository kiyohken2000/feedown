import React from "react";
import { View, Text, StyleSheet } from "react-native";
import ScreenTemplate from "../../components/ScreenTemplate";

export default function Menu() {
  return (
    <ScreenTemplate>
      <View style={styles.container}>
        <Text>Menu screen</Text>
        <View style={styles.textContainer}>
          <Text>ボトムタブありヘッダーなしモーダル</Text>
        </View>
      </View>
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  textContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5
  }
})