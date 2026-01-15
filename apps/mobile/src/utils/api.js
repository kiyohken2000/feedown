/**
 * FeedOwn API Client for Mobile
 * Supports dynamic server URL configuration
 */

import { getServerUrl, getAuthToken } from './supabase'

/**
 * API Client class for making authenticated requests
 */
class ApiClient {
  constructor(getServerUrlFn, getAuthTokenFn) {
    this.getServerUrl = getServerUrlFn
    this.getAuthToken = getAuthTokenFn
  }

  async request(endpoint, options = {}) {
    try {
      const baseUrl = await this.getServerUrl()
      const token = await this.getAuthToken()
      const headers = {
        'Content-Type': 'application/json',
      }

      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      })

      const contentType = response.headers.get('content-type')
      const hasJsonContent = contentType && contentType.includes('application/json')

      let data = null
      if (hasJsonContent) {
        const text = await response.text()
        if (text) {
          try {
            data = JSON.parse(text)
          } catch (e) {
            console.error('Failed to parse JSON response:', e)
            data = null
          }
        }
      }

      if (!response.ok) {
        return {
          success: false,
          error: data?.error || `HTTP ${response.status}: ${response.statusText}`,
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
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Login failed',
        }
      }

      return {
        success: true,
        data: {
          user: data.user,
          token: data.token,
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
      const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Registration failed',
        }
      }

      return {
        success: true,
        data: {
          user: data.user,
          token: data.token,
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
}

/**
 * Refresh API
 */
class RefreshAPI {
  constructor(client) {
    this.client = client
  }

  async refreshAll() {
    return this.client.post('/api/refresh')
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
