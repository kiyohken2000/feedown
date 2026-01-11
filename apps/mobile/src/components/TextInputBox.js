import React, { useState, useContext, useEffect } from 'react'
import { TextInput, StyleSheet } from 'react-native'
import { colors } from '../theme'

export default function TextInputBox(props) {
  const { 
    secureTextEntry,
    placeholder,
    onChangeText,
    value,
    autoCapitalize,
    keyboardType,
    maxLength,
  } = props

  return (
    <TextInput
      style={styles.input}
      placeholderTextColor={colors.grayPrimary}
      secureTextEntry={secureTextEntry}
      placeholder={placeholder}
      onChangeText={onChangeText}
      value={value}
      underlineColorAndroid="transparent"
      autoCapitalize={autoCapitalize}
      keyboardType={keyboardType}
      maxLength={maxLength}
    />
  )
}

const styles = StyleSheet.create({
  input: {
    height: 48,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: 'white',
    paddingLeft: 16,
    borderWidth: 1,
    borderColor: colors.grayPrimary,
  },
})