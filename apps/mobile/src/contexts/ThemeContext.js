import React, { createContext, useState, useEffect, useContext } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const ThemeContext = createContext()

const THEME_KEY = '@feedown_theme'

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Load saved theme on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_KEY)
        if (savedTheme !== null) {
          setIsDarkMode(savedTheme === 'true')
        }
      } catch (error) {
        console.error('Failed to load theme:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadTheme()
  }, [])

  // Save theme when it changes
  useEffect(() => {
    if (!isLoading) {
      AsyncStorage.setItem(THEME_KEY, isDarkMode.toString()).catch((error) => {
        console.error('Failed to save theme:', error)
      })
    }
  }, [isDarkMode, isLoading])

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev)
  }

  const value = {
    isDarkMode,
    toggleDarkMode,
    isLoading,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export { ThemeContext }
