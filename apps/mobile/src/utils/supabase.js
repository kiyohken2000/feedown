import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Storage keys
const SERVER_URL_KEY = '@feedown_server_url'
const AUTH_TOKEN_KEY = '@feedown_auth_token'
const REFRESH_TOKEN_KEY = '@feedown_refresh_token'
const USER_KEY = '@feedown_user'

/**
 * Get the saved server URL from AsyncStorage
 */
export async function getServerUrl() {
  try {
    const url = await AsyncStorage.getItem(SERVER_URL_KEY)
    return url || ''
  } catch (error) {
    console.error('Failed to get server URL:', error)
    return ''
  }
}

/**
 * Save the server URL to AsyncStorage
 */
export async function saveServerUrl(url) {
  try {
    // Normalize URL (remove trailing slash)
    const normalizedUrl = url.replace(/\/+$/, '')
    await AsyncStorage.setItem(SERVER_URL_KEY, normalizedUrl)
    return normalizedUrl
  } catch (error) {
    console.error('Failed to save server URL:', error)
    throw error
  }
}

/**
 * Get the saved auth token from AsyncStorage
 */
export async function getAuthToken() {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY)
  } catch (error) {
    console.error('Failed to get auth token:', error)
    return null
  }
}

/**
 * Save the auth token to AsyncStorage
 */
export async function saveAuthToken(token) {
  try {
    if (token) {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token)
    } else {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY)
    }
  } catch (error) {
    console.error('Failed to save auth token:', error)
    throw error
  }
}

/**
 * Get the saved refresh token from AsyncStorage
 */
export async function getRefreshToken() {
  try {
    return await AsyncStorage.getItem(REFRESH_TOKEN_KEY)
  } catch (error) {
    console.error('Failed to get refresh token:', error)
    return null
  }
}

/**
 * Save the refresh token to AsyncStorage
 */
export async function saveRefreshToken(token) {
  try {
    if (token) {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, token)
    } else {
      await AsyncStorage.removeItem(REFRESH_TOKEN_KEY)
    }
  } catch (error) {
    console.error('Failed to save refresh token:', error)
    throw error
  }
}

/**
 * Get the saved user from AsyncStorage
 */
export async function getUser() {
  try {
    const userJson = await AsyncStorage.getItem(USER_KEY)
    return userJson ? JSON.parse(userJson) : null
  } catch (error) {
    console.error('Failed to get user:', error)
    return null
  }
}

/**
 * Save the user to AsyncStorage
 */
export async function saveUser(user) {
  try {
    if (user) {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user))
    } else {
      await AsyncStorage.removeItem(USER_KEY)
    }
  } catch (error) {
    console.error('Failed to save user:', error)
    throw error
  }
}

/**
 * Clear all auth data from AsyncStorage
 */
export async function clearAuthData() {
  try {
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, SERVER_URL_KEY])
  } catch (error) {
    console.error('Failed to clear auth data:', error)
    throw error
  }
}

/**
 * Validate a server URL by checking if it responds
 */
export async function validateServerUrl(url) {
  try {
    const normalizedUrl = url.replace(/\/+$/, '')
    const response = await fetch(`${normalizedUrl}/api/recommended-feeds`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    return response.ok
  } catch (error) {
    console.error('Server validation failed:', error)
    return false
  }
}

// For backward compatibility - API base URL getter
export async function getApiBaseUrl() {
  return getServerUrl()
}

// Legacy export for backward compatibility
export const API_BASE_URL = ''
