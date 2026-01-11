import React, { useContext } from "react";
import { View, Text, StyleSheet } from "react-native";
import { UserContext } from "../../contexts/UserContext";
import { HomeTitleContext } from "../../contexts/HomeTitleContext";
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native'
import Button from '../../components/Button'
import { colors } from '../../theme'
import ScreenTemplate from "../../components/ScreenTemplate";

export default function Modal() {
  const { user } = useContext(UserContext)
  const { setTitle } = useContext(HomeTitleContext)
  const navigation = useNavigation()
  const route = useRoute()
  const { from } = route.params

  useFocusEffect(() => {
    setTitle(user.id)
  });

  return (
    <ScreenTemplate>
      <View style={styles.container}>
        <Text>ID: {user.id}</Text>
        <Text>From: {from} screen</Text>
        <View style={styles.textContainer}>
          <Text>ボトムタブなし、ヘッダーありのモーダル</Text>
        </View>
        <View style={styles.buttonContainer}>
          <Button
            label="Go to Print"
            color={colors.darkPurple}
            labelColor={colors.white}
            disable={false}
            onPress={() => {
              navigation.navigate('Print', { from: 'Modal' })
            }}
          />
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
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 10
  }
})