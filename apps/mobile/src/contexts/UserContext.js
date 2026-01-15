import React, { createContext, useState, useEffect } from 'react'
import {
  getServerUrl,
  saveServerUrl,
  getAuthToken,
  saveAuthToken,
  getUser,
  saveUser,
  clearAuthData,
} from '../utils/supabase'
import { createApiClientWithUrl } from '../utils/api'

export const UserContext = createContext()

export const UserContextProvider = (props) => {
  const [user, setUser] = useState(null)
  const [serverUrl, setServerUrlState] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // Load saved session on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        const [savedUrl, savedToken, savedUser] = await Promise.all([
          getServerUrl(),
          getAuthToken(),
          getUser(),
        ])

        setServerUrlState(savedUrl)

        if (savedToken && savedUser) {
          setUser(savedUser)
        }
      } catch (error) {
        console.error('Failed to load session:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadSession()
  }, [])

  // Update server URL
  const setServerUrl = async (url) => {
    const normalizedUrl = await saveServerUrl(url)
    setServerUrlState(normalizedUrl)
    return normalizedUrl
  }

  // Sign in with email/password via API
  const signIn = async (email, password, customServerUrl = null) => {
    const url = customServerUrl || serverUrl
    const api = createApiClientWithUrl(url)
    const response = await api.auth.login(email, password)

    if (!response.success) {
      throw new Error(response.error)
    }

    const { user: userData, token } = response.data

    // Save session data
    await Promise.all([
      saveAuthToken(token),
      saveUser(userData),
      customServerUrl ? saveServerUrl(customServerUrl) : Promise.resolve(),
    ])

    if (customServerUrl) {
      setServerUrlState(customServerUrl)
    }

    setUser(userData)
    return response.data
  }

  // Sign up with email/password via API
  const signUp = async (email, password, customServerUrl = null) => {
    const url = customServerUrl || serverUrl
    const api = createApiClientWithUrl(url)
    const response = await api.auth.register(email, password)

    if (!response.success) {
      throw new Error(response.error)
    }

    const { user: userData, token } = response.data

    // Save session data
    await Promise.all([
      saveAuthToken(token),
      saveUser(userData),
      customServerUrl ? saveServerUrl(customServerUrl) : Promise.resolve(),
    ])

    if (customServerUrl) {
      setServerUrlState(customServerUrl)
    }

    setUser(userData)
    return response.data
  }

  // Sign out
  const signOut = async () => {
    await clearAuthData()
    setUser(null)
  }

  // Get access token for API calls
  const getAccessToken = async () => {
    return getAuthToken()
  }

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        serverUrl,
        setServerUrl,
        isLoading,
        signIn,
        signUp,
        signOut,
        getAccessToken,
      }}
    >
      {props.children}
    </UserContext.Provider>
  )
}
