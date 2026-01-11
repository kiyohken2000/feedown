import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRoute } from "@react-navigation/native";
import ScreenTemplate from "../../components/ScreenTemplate";
import { colors } from "../../theme";
import { storage } from '../../utils/storage'
import moment from 'moment'
import Button from '../../components/Button'

export default function Print() {
  const route = useRoute()
  const { from } = route.params
  const [date, setDate] = useState('')

  useEffect(() => {
    loadStorage()
  }, [])

  const loadStorage = async() => {
    try {
      const result = await storage.load({key: 'date'})
      setDate(result)
    } catch (e) {
      const result = {date: 'no data'}
      setDate(result)
    }
  }

  const saveStorage = () => {
    const today = moment().toString()
    storage.save({
      key: 'date',
      data: {
        'date': today
      }
    })
  }

  const removeStorage = () => {
    storage.remove({ key: 'date' })
  }

  const onSavePress = () => {
    saveStorage()
    loadStorage()
  }

  const onRemovePress = () => {
    removeStorage()
    loadStorage()
  }

  return (
    <ScreenTemplate>
      <View style={styles.container}>
        <Text>Print screen</Text>
        <Text>From: {from} screen</Text>
        <View style={styles.textContainer}>
          <Text>ボトムタブなしヘッダーありモーダル</Text>
          <Text>Latest save date</Text>
          <Text>{date.date}</Text>
        </View>
        <View style={styles.buttonContainer}>
          <Button
            label="Save Date"
            color={colors.darkPurple}
            disable={false}
            labelColor={colors.white}
            onPress={onSavePress}
          />
          <View style={{marginVertical: 10}} />
          <Button
            label="Remove Date"
            color={colors.purple}
            disable={false}
            labelColor={colors.white}
            onPress={onRemovePress}
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