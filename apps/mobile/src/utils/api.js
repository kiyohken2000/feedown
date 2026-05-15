/**
 * FeedOwn API Client for Mobile
 * Supports dynamic server URL configuration
 */

import { getServerUrl, getAuthToken, getRefreshToken, saveAuthToken, saveRefreshToken } from './supabase'
import { appVersion } from '../config'

const FEEDOWN_USER_AGENT = `FeedOwn-Mobile/${appVersion}`

const DEFAULT_API_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'X-Requested-With': 'FeedOwnMobile',
  'User-Agent': FEEDOWN_USER_AGENT,
}

// Reads a fetch Response defensively. Never throws on non-JSON bodies — instead
// returns an actionable error so the UI never shows a raw "JSON Parse error".
async function safeReadJsonResponse(response) {
  const contentType = (response.headers.get('content-type') || '').toLowerCase()
  let text = ''
  try {
    text = await response.text()
  } catch (e) {
    return {
      ok: false,
      data: null,
      error: `Could not read server response (HTTP ${response.status}). Please check your network connection and try again.`,
    }
  }

  if (!text) {
    return { ok: true, data: null, error: null }
  }

  if (!contentType.includes('application/json')) {
    return {
      ok: false,
      data: null,
      error: `The server didn't return a valid response (HTTP ${response.status}, ${contentType || 'unknown content type'}). Please verify the Server URL is correct and try again.`,
    }
  }

  try {
    return { ok: true, data: JSON.parse(text), error: null }
  } catch (e) {
    return {
      ok: false,
      data: null,
      error: `The server returned a malformed response (HTTP ${response.status}). Please try again in a moment.`,
    }
  }
}

// Wraps fetch + safeReadJsonResponse with one transparent retry when an edge
// component (e.g. CDN bot challenge) returns a non-JSON body. Real auth errors
// (HTTP 401 with a JSON body) are NOT retried — they pass through immediately.
async function fetchJsonWithRetry(url, options) {
  const RETRY_DELAY_MS = 1500
  let attempt = 0
  let response = null
  let parsed = null
  let networkError = null

  while (attempt < 2) {
    networkError = null
    try {
      response = await fetch(url, options)
    } catch (e) {
      networkError = e
      response = null
      parsed = null
      if (attempt === 0) {
        attempt += 1
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
        continue
      }
      break
    }

    parsed = await safeReadJsonResponse(response)
    if (parsed.ok) {
      return { response, parsed, networkError: null }
    }

    if (attempt === 0) {
      attempt += 1
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
      continue
    }
    break
  }

  return { response, parsed, networkError }
}

/**
 * API Client class for making authenticated requests
 */
class ApiClient {
  constructor(getServerUrlFn, getAuthTokenFn) {
    this.getServerUrl = getServerUrlFn
    this.getAuthToken = getAuthTokenFn
    this.isRefreshing = false
  }

  async refreshToken() {
    if (this.isRefreshing) {
      // Wait for ongoing refresh
      await new Promise(resolve => setTimeout(resolve, 1000))
      return await this.getAuthToken()
    }

    this.isRefreshing = true
    try {
      const baseUrl = await this.getServerUrl()
      const refreshToken = await getRefreshToken()

      if (!refreshToken) {
        return null
      }

      const { response, parsed } = await fetchJsonWithRetry(
        `${baseUrl}/api/auth/refresh`,
        {
          method: 'POST',
          headers: { ...DEFAULT_API_HEADERS },
          body: JSON.stringify({ refreshToken }),
        }
      )

      if (!response || !response.ok) {
        return null
      }

      if (!parsed || !parsed.ok || !parsed.data) {
        return null
      }
      const data = parsed.data
      if (data.success && data.token) {
        await saveAuthToken(data.token)
        if (data.refreshToken) {
          await saveRefreshToken(data.refreshToken)
        }
        return data.token
      }
      return null
    } catch (error) {
      console.error('Token refresh failed:', error)
      return null
    } finally {
      this.isRefreshing = false
    }
  }

  async request(endpoint, options = {}, isRetry = false) {
    try {
      const baseUrl = await this.getServerUrl()
      const token = await this.getAuthToken()
      const headers = { ...DEFAULT_API_HEADERS }

      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const { response, parsed, networkError } = await fetchJsonWithRetry(
        `${baseUrl}${endpoint}`,
        {
          ...options,
          headers: {
            ...headers,
            ...options.headers,
          },
        }
      )

      if (!response) {
        return {
          success: false,
          error: networkError?.message || 'Network error. Please check your connection and try again.',
        }
      }

      const data = parsed?.data

      // Handle 401 Unauthorized - try to refresh token
      if (response.status === 401 && !isRetry) {
        const newToken = await this.refreshToken()
        if (newToken) {
          return this.request(endpoint, options, true)
        }
      }

      if (!response.ok) {
        return {
          success: false,
          error: data?.error || parsed?.error || `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' })
  }

  async post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async patch(endpoint, body) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' })
  }
}

/**
 * Auth API
 */
class AuthAPI {
  constructor(getServerUrl) {
    this.getServerUrl = getServerUrl
  }

  async login(email, password) {
    try {
      const baseUrl = await this.getServerUrl()
      const { response, parsed, networkError } = await fetchJsonWithRetry(
        `${baseUrl}/api/auth/login`,
        {
          method: 'POST',
          headers: { ...DEFAULT_API_HEADERS },
          body: JSON.stringify({ email, password }),
        }
      )

      if (!response) {
        return {
          success: false,
          error: networkError?.message || 'Network error. Please check your connection and try again.',
        }
      }

      if (!parsed.ok) {
        return { success: false, error: parsed.error }
      }
      const data = parsed.data || {}

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `Login failed (HTTP ${response.status})`,
        }
      }

      return {
        success: true,
        data: {
          user: data.user,
          token: data.token,
          refreshToken: data.refreshToken,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Login failed',
      }
    }
  }

  async register(email, password) {
    try {
      const baseUrl = await this.getServerUrl()
      const { response, parsed, networkError } = await fetchJsonWithRetry(
        `${baseUrl}/api/auth/register`,
        {
          method: 'POST',
          headers: { ...DEFAULT_API_HEADERS },
          body: JSON.stringify({ email, password }),
        }
      )

      if (!response) {
        return {
          success: false,
          error: networkError?.message || 'Network error. Please check your connection and try again.',
        }
      }

      if (!parsed.ok) {
        return { success: false, error: parsed.error }
      }
      const data = parsed.data || {}

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `Registration failed (HTTP ${response.status})`,
        }
      }

      return {
        success: true,
        data: {
          user: data.user,
          token: data.token,
          refreshToken: data.refreshToken,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Registration failed',
      }
    }
  }
}

/**
 * Feeds API
 */
class FeedsAPI {
  constructor(client) {
    this.client = client
  }

  async list() {
    return this.client.get('/api/feeds')
  }

  async add(url) {
    return this.client.post('/api/feeds', { url })
  }

  async delete(feedId) {
    return this.client.delete(`/api/feeds/${feedId}`)
  }

  async update(feedId, data) {
    return this.client.patch(`/api/feeds/${feedId}`, data)
  }
}

/**
 * Articles API
 */
class ArticlesAPI {
  constructor(client) {
    this.client = client
  }

  async list(params = {}) {
    const query = new URLSearchParams()
    if (params.feedId) query.set('feedId', params.feedId)
    if (params.unreadOnly) query.set('unreadOnly', 'true')
    if (params.limit) query.set('limit', params.limit.toString())
    if (params.offset) query.set('offset', params.offset.toString())

    const queryString = query.toString()
    return this.client.get(`/api/articles${queryString ? `?${queryString}` : ''}`)
  }

  async markAsRead(articleId) {
    return this.client.post(`/api/articles/${articleId}/read`)
  }

  async batchMarkAsRead(articleIds) {
    return this.client.post('/api/articles/batch-read', { articleIds })
  }

  async addToFavorites(articleId, articleData) {
    return this.client.post(`/api/articles/${articleId}/favorite`, articleData)
  }

  async removeFromFavorites(articleId) {
    return this.client.delete(`/api/articles/${articleId}/favorite`)
  }

  async getContent(articleUrl) {
    const encodedUrl = encodeURIComponent(articleUrl)
    return this.client.get(`/api/article-content?url=${encodedUrl}`)
  }
}

/**
 * Refresh API
 */
class RefreshAPI {
  constructor(client) {
    this.client = client
  }

  async refreshAll(offset) {
    const query = offset ? `?offset=${offset}` : ''
    return this.client.post(`/api/refresh${query}`)
  }

  async refreshFeed(feedId) {
    return this.client.post('/api/refresh', { feedId })
  }
}

/**
 * Favorites API
 */
class FavoritesAPI {
  constructor(client) {
    this.client = client
  }

  async list() {
    return this.client.get('/api/favorites')
  }
}

/**
 * User API
 */
class UserAPI {
  constructor(client) {
    this.client = client
  }

  async deleteAccount() {
    return this.client.delete('/api/user/account')
  }

  async clearAllData() {
    return this.client.delete('/api/user/data')
  }
}

/**
 * Main FeedOwn API class
 */
export class FeedOwnAPI {
  constructor(getServerUrlFn, getAuthTokenFn) {
    const client = new ApiClient(getServerUrlFn, getAuthTokenFn)
    this.auth = new AuthAPI(getServerUrlFn)
    this.feeds = new FeedsAPI(client)
    this.articles = new ArticlesAPI(client)
    this.refresh = new RefreshAPI(client)
    this.favorites = new FavoritesAPI(client)
    this.user = new UserAPI(client)
  }
}

/**
 * Create API client instance
 * Uses the stored server URL and auth token
 */
export function createApiClient(customGetAuthToken) {
  return new FeedOwnAPI(getServerUrl, customGetAuthToken || getAuthToken)
}

/**
 * Create API client with custom server URL
 * Used during login/signup before URL is saved
 */
export function createApiClientWithUrl(serverUrl, authToken = null) {
  const getServerUrlFn = async () => serverUrl
  const getAuthTokenFn = async () => authToken
  return new FeedOwnAPI(getServerUrlFn, getAuthTokenFn)
}
