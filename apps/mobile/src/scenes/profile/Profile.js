import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Button from '../../components/Button'
import { colors, fontSize } from '../../theme'
import { useNavigation } from '@react-navigation/native'
import ScreenTemplate from '../../components/ScreenTemplate'

export default function Profile() {
  const navigation = useNavigation()

  return (
    <ScreenTemplate>
      <View style={styles.root}>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.buttonContainer}>
          <Button
            label="Go to Details"
            color={colors.darkPurple}
            labelColor={colors.white}
            disable={false}
            onPress={() => {
              navigation.navigate('Details', { from: 'Profile' })
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
  },
  title: {
    fontSize: fontSize.xxxLarge,
    marginBottom: 20,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 10
  }
})
