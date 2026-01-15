import React from 'react'
import { TextInput, StyleSheet } from 'react-native'
import { colors, getThemeColors } from '../theme'
import { useTheme } from '../contexts/ThemeContext'

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
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)

  return (
    <TextInput
      style={[
        styles.input,
        {
          backgroundColor: theme.inputBackground,
          borderColor: theme.inputBorder,
          color: theme.text,
        }
      ]}
      placeholderTextColor={theme.textMuted}
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