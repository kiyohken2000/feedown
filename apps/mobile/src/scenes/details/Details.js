import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Button from '../../components/Button'
import { colors, fontSize } from '../../theme'
import { useNavigation, useRoute } from '@react-navigation/native'
import ScreenTemplate from '../../components/ScreenTemplate'

export default function Details() {
  const route = useRoute()
  const navigation = useNavigation()
  const { from } = route?.params

  return (
    <ScreenTemplate>
      <View style={styles.root}>
        <Text style={styles.title}>{`Details (from ${from})`}</Text>
        <View style={styles.textContainer}>
          <Text>ヘッダーあり</Text>
        </View>
        <View style={styles.buttonContainer}>
          <Button
            label="Go Back"
            onPress={navigation.goBack}
            color={colors.darkPurple}
            disable={false}
            labelColor={colors.white}
          />
          <View style={{marginVertical: 20}} />
          <Button
            label="Go to Modal"
            color={colors.bluePrimary}
            labelColor={colors.white}
            disable={false}
            onPress={() => {
              navigation.navigate('ModalStack', {
                screen: 'Modal',
                params: {from: 'Details'}
              })
            }}
          />
        </View>
      </View>
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lightGrayPurple,
  },
  title: {
    fontSize: fontSize.xxxLarge,
    marginBottom: 20,
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
