import React, { createContext, useState, useEffect, useContext } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const ThemeContext = createContext()

const THEME_KEY = '@feedown_theme'
const FONT_SIZE_KEY = '@feedown_font_size'

// Font size options
export const FONT_SIZE_OPTIONS = {
  small: { label: 'Small', bodySize: 15, lineHeight: 24 },
  medium: { label: 'Medium', bodySize: 17, lineHeight: 28 },
  large: { label: 'Large', bodySize: 19, lineHeight: 32 },
  xlarge: { label: 'Extra Large', bodySize: 21, lineHeight: 36 },
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [readerFontSize, setReaderFontSize] = useState('medium')
  const [isLoading, setIsLoading] = useState(true)

  // Load saved theme and font size on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [savedTheme, savedFontSize] = await Promise.all([
          AsyncStorage.getItem(THEME_KEY),
          AsyncStorage.getItem(FONT_SIZE_KEY),
        ])
        if (savedTheme !== null) {
          setIsDarkMode(savedTheme === 'true')
        }
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

  // Save theme when it changes
  useEffect(() => {
    if (!isLoading) {
      AsyncStorage.setItem(THEME_KEY, isDarkMode.toString()).catch((error) => {
        console.error('Failed to save theme:', error)
      })
    }
  }, [isDarkMode, isLoading])

  // Save font size when it changes
  useEffect(() => {
    if (!isLoading) {
      AsyncStorage.setItem(FONT_SIZE_KEY, readerFontSize).catch((error) => {
        console.error('Failed to save font size:', error)
      })
    }
  }, [readerFontSize, isLoading])

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev)
  }

  const setFontSize = (size) => {
    if (FONT_SIZE_OPTIONS[size]) {
      setReaderFontSize(size)
    }
  }

  const getFontSizeConfig = () => {
    return FONT_SIZE_OPTIONS[readerFontSize] || FONT_SIZE_OPTIONS.medium
  }

  const value = {
    isDarkMode,
    toggleDarkMode,
    readerFontSize,
    setFontSize,
    getFontSizeConfig,
    isLoading,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export { ThemeContext }
