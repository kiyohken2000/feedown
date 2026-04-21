import React, { createContext, useState, useEffect, useContext } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useColorScheme } from 'react-native'

const ThemeContext = createContext()

const THEME_MODE_KEY = '@feedown_theme_mode' // 'light' | 'dark' | 'system'
const FONT_SIZE_KEY = '@feedown_font_size'

export const FONT_SIZE_OPTIONS = {
  small: { label: 'Small', bodySize: 15, lineHeight: 24 },
  medium: { label: 'Medium', bodySize: 17, lineHeight: 28 },
  large: { label: 'Large', bodySize: 19, lineHeight: 32 },
  xlarge: { label: 'Extra Large', bodySize: 21, lineHeight: 36 },
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme() // 'light' | 'dark' | null
  const [themeMode, setThemeMode] = useState('system') // 'light' | 'dark' | 'system'
  const [readerFontSize, setReaderFontSize] = useState('medium')
  const [isLoading, setIsLoading] = useState(true)

  // 設定ロード
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [savedMode, savedFontSize] = await Promise.all([
          AsyncStorage.getItem(THEME_MODE_KEY),
          AsyncStorage.getItem(FONT_SIZE_KEY),
        ])
        if (savedMode !== null) setThemeMode(savedMode)
        if (savedFontSize !== null && FONT_SIZE_OPTIONS[savedFontSize]) {
          setReaderFontSize(savedFontSize)
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadSettings()
  }, [])

  // テーマモード保存
  useEffect(() => {
    if (!isLoading) {
      AsyncStorage.setItem(THEME_MODE_KEY, themeMode).catch(console.error)
    }
  }, [themeMode, isLoading])

  // フォントサイズ保存
  useEffect(() => {
    if (!isLoading) {
      AsyncStorage.setItem(FONT_SIZE_KEY, readerFontSize).catch(console.error)
    }
  }, [readerFontSize, isLoading])

  // 実際のダークモード状態
  const isDarkMode =
    themeMode === 'dark' ? true :
    themeMode === 'light' ? false :
    systemColorScheme === 'dark' // 'system'

  // 後方互換のためtoggleDarkModeも残す
  const toggleDarkMode = () => {
    setThemeMode(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const setTheme = (mode) => {
    // 'light' | 'dark' | 'system'
    setThemeMode(mode)
  }

  const setFontSize = (size) => {
    if (FONT_SIZE_OPTIONS[size]) setReaderFontSize(size)
  }

  const getFontSizeConfig = () => {
    return FONT_SIZE_OPTIONS[readerFontSize] || FONT_SIZE_OPTIONS.medium
  }

  return (
    <ThemeContext.Provider value={{
      isDarkMode,
      themeMode,
      toggleDarkMode,
      setTheme,
      readerFontSize,
      setFontSize,
      getFontSizeConfig,
      isLoading,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export { ThemeContext }