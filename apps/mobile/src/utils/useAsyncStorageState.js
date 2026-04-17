import { useState, useEffect, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * AsyncStorageに値を永続化するuseStateの代替フック（モバイル用）
 * @param {string} key - AsyncStorage key
 * @param {*} defaultValue - デフォルト値
 */
export const useAsyncStorageState = (key, defaultValue) => {
  const [state, setState] = useState(defaultValue)
  const isLoaded = useRef(false)

  // 初回ロード
  useEffect(() => {
    AsyncStorage.getItem(key).then(saved => {
      if (saved !== null) {
        try {
          setState(JSON.parse(saved))
        } catch {
          setState(saved)
        }
      }
      isLoaded.current = true
    }).catch(console.error)
  }, [key])

  const setPersistedState = (value) => {
    const next = typeof value === 'function' ? value(state) : value
    setState(next)
    AsyncStorage.setItem(key, JSON.stringify(next)).catch(console.error)
  }

  return [state, setPersistedState]
}
