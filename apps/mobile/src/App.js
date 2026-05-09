import React, { useState, useEffect } from 'react'
import { View } from 'react-native'
import { Provider } from 'react-redux'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { initExecutorch } from 'react-native-executorch'
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher'
import store from 'utils/store'
import 'utils/ignore'
import { UserContextProvider } from './contexts/UserContext'
import { FeedsContextProvider } from './contexts/FeedsContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { AiProvider } from './contexts/AiContext'

initExecutorch({ resourceFetcher: ExpoResourceFetcher })

// assets
import { imageAssets } from 'theme/images'
import { fontAssets } from 'theme/fonts'
import Router from './routes'

export default function App() {
  // state
  const [didLoad, setDidLoad] = useState(false)

  // handler
  const handleLoadAssets = async () => {
    // assets preloading
    await Promise.all([...imageAssets, ...fontAssets])
    setDidLoad(true)
  }

  // lifecycle
  useEffect(() => {
    handleLoadAssets()
  }, [])

  // rendering
  if (!didLoad) return <View />
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <ThemeProvider>
          <UserContextProvider>
            <FeedsContextProvider>
              <AiProvider>
                <Router />
              </AiProvider>
            </FeedsContextProvider>
          </UserContextProvider>
        </ThemeProvider>
      </Provider>
    </SafeAreaProvider>
  )
}
