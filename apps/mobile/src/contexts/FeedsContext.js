import React, { createContext, useState, useContext, useCallback, useEffect } from 'react'
import { UserContext } from './UserContext'
import { createApiClient } from '../utils/api'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const FeedsContext = createContext()

export const FeedsContextProvider = ({ children }) => {
  const { getAccessToken, serverUrl } = useContext(UserContext)

  // State
  const [articles, setArticles] = useState([])
  const [readArticles, setReadArticles] = useState(new Set())
  const [favoritedArticles, setFavoritedArticles] = useState(new Set())
  const [favorites, setFavorites] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [feeds, setFeeds] = useState([])
  
  // 起動時にキャッシュから読み込む
  useEffect(() => {
    AsyncStorage.getItem('@cached_feeds').then(cached => {
      if (cached) setFeeds(JSON.parse(cached))
    }).catch(console.error)
  }, [])

  const setFeedsWithCache = useCallback((feedsData) => {
  setFeeds(feedsData)  // ← setFeeds を呼ぶ
  AsyncStorage.setItem('@cached_feeds', JSON.stringify(feedsData)).catch(console.error)
  }, [])

  // Create API client
  const getApi = useCallback(() => {
    return createApiClient(getAccessToken)
  }, [getAccessToken])

  // Fetch feeds
  const fetchFeeds = useCallback(async () => {
    try {
      const api = getApi()
      const response = await api.feeds.list()
      if (response.success) {
        let feedsData = response.data.feeds || []

        // カテゴリをサーバーから取得してマージ
        try {
          const token = await getAccessToken()
          const catRes = await fetch(`${serverUrl}/api/feed-categories`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          const catData = await catRes.json()
          if (catData.success) {
            const catMap = {}
            catData.data.categories.forEach(c => { catMap[c.id] = c.category })
            feedsData = feedsData.map(f => ({ ...f, category: catMap[f.id] || null }))
          }
        } catch (e) {
          console.log('Category fetch skipped:', e.message)
        }

        setFeedsWithCache(feedsData) 
        return feedsData
      } else {
        throw new Error(response.error)
      }
    } catch (err) {
      console.error('Failed to fetch feeds:', err)
      setError(err.message)
      return []
    }
  }, [getApi, getAccessToken, serverUrl])

  // Fetch articles
  const fetchArticles = useCallback(async (reset = true, limit = 50) => {
    try {
      if (reset) {
        setIsLoading(true)
        setHasMore(true)
      }
      setError(null)

      const currentOffset = reset ? 0 : articles.length
      const api = getApi()
      const response = await api.articles.list({
        limit,
        offset: currentOffset,
      })

      if (response.success) {
        const newArticles = response.data.articles || []
        const hasMoreData = response.data.hasMore ?? (newArticles.length === limit)

        if (reset) {
          setArticles(newArticles)
        } else {
          setArticles(prev => [...prev, ...newArticles])
        }

        setHasMore(hasMoreData)

        // Build read articles set
        if (reset) {
          // Full reset: rebuild from fetched articles only
          const readSet = new Set()
          newArticles.forEach(article => {
            if (article.isRead) {
              readSet.add(article.id)
            }
          })
          setReadArticles(readSet)
        } else {
          // Load more: preserve existing read status and add new
          setReadArticles(prev => {
            const readSet = new Set(prev)
            newArticles.forEach(article => {
              if (article.isRead) {
                readSet.add(article.id)
              }
            })
            return readSet
          })
        }

        return newArticles
      } else {
        throw new Error(response.error)
      }
    } catch (err) {
      console.error('Failed to fetch articles:', err)
      setError(err.message)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [getApi, articles.length, readArticles])

  // Refresh all feeds in batches to stay within Cloudflare's 50 subrequest limit
  const refreshAll = useCallback(async () => {
    try {
      setIsRefreshing(true)
      setError(null)

      const api = getApi()
      let offset = 0
      let totalNewArticles = 0
      let totalSuccessful = 0
      let totalFeeds = 0
      let latestFeeds = null

      while (true) {
        const refreshResponse = await api.refresh.refreshAll(offset || undefined)
        if (!refreshResponse.success) {
          console.error('Refresh batch failed at offset', offset)
          break
        }

        const { stats, remaining, nextOffset } = refreshResponse.data
        totalFeeds = stats?.totalFeeds || 0
        totalSuccessful += stats?.successfulFeeds || 0
        totalNewArticles += stats?.newArticles || 0

        if (refreshResponse.data.feeds) {
          latestFeeds = refreshResponse.data.feeds
        }

        console.log(`Batch at offset ${offset}: ${stats?.successfulFeeds} ok, ${stats?.newArticles} new, ${remaining ?? 0} remaining`)

        if (!remaining || remaining <= 0 || !nextOffset) break
        offset = nextOffset
      }

      console.log(`Refresh complete: ${totalSuccessful}/${totalFeeds} feeds, ${totalNewArticles} new articles`)

      await fetchFeeds()

      // Fetch articles after refresh
      await fetchArticles(true)

      return { success: true, stats: { totalFeeds, successfulFeeds: totalSuccessful, newArticles: totalNewArticles } }
    } catch (err) {
      console.error('Failed to refresh:', err)
      setError(err.message)
      // ネットワークエラー時はキャッシュをそのまま使う（fetchFeedsは呼ばない）
      return { success: false, error: err.message }
    }finally {
      setIsRefreshing(false)
    }
  }, [getApi, fetchFeeds, fetchArticles])

  // Mark article as read
  const markAsRead = useCallback(async (articleId) => {
    try {
      // Optimistic update
      setReadArticles(prev => new Set([...prev, articleId]))

      const api = getApi()
      const response = await api.articles.markAsRead(articleId)

      if (!response.success) {
        // Rollback on error
        setReadArticles(prev => {
          const newSet = new Set(prev)
          newSet.delete(articleId)
          return newSet
        })
        throw new Error(response.error)
      }
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }, [getApi])

  // Batch mark articles as read
  const batchMarkAsRead = useCallback(async (articleIds) => {
    try {
      // Optimistic update
      setReadArticles(prev => {
        const newSet = new Set(prev)
        articleIds.forEach(id => newSet.add(id))
        return newSet
      })

      const api = getApi()
      const response = await api.articles.batchMarkAsRead(articleIds)

      if (!response.success) {
        // Rollback on error
        setReadArticles(prev => {
          const newSet = new Set(prev)
          articleIds.forEach(id => newSet.delete(id))
          return newSet
        })
        throw new Error(response.error)
      }
    } catch (err) {
      console.error('Failed to batch mark as read:', err)
      throw err
    }
  }, [getApi])

  // Fetch favorites
  const fetchFavorites = useCallback(async () => {
    try {
      const api = getApi()
      const response = await api.favorites.list()

      if (response.success) {
        const favoritesList = response.data.favorites || []
        setFavorites(favoritesList)
        // Build favorited articles set
        const favoritedSet = new Set(favoritesList.map(f => f.articleId))
        setFavoritedArticles(favoritedSet)
        return favoritesList
      } else {
        throw new Error(response.error)
      }
    } catch (err) {
      console.error('Failed to fetch favorites:', err)
      return []
    }
  }, [getApi])

  // Toggle favorite
  const toggleFavorite = useCallback(async (article) => {
    try {
      const api = getApi()
      const isFavorited = favoritedArticles.has(article.id)

      if (isFavorited) {
        // Optimistic update - remove from favoritedArticles Set
        setFavoritedArticles(prev => {
          const newSet = new Set(prev)
          newSet.delete(article.id)
          return newSet
        })
        // Also remove from favorites array
        setFavorites(prev => prev.filter(f => f.articleId !== article.id))

        const response = await api.articles.removeFromFavorites(article.id)
        if (!response.success) {
          // Rollback
          setFavoritedArticles(prev => new Set([...prev, article.id]))
          // Re-fetch favorites to restore
          fetchFavorites()
          throw new Error(response.error)
        }
      } else {
        // Optimistic update - add to favoritedArticles Set
        setFavoritedArticles(prev => new Set([...prev, article.id]))
        // Also add to favorites array
        const newFavorite = {
          articleId: article.id,
          title: article.title,
          url: article.url,
          description: article.description,
          feedTitle: article.feedTitle,
          imageUrl: article.imageUrl,
          createdAt: new Date().toISOString(),
        }
        setFavorites(prev => [newFavorite, ...prev])

        const response = await api.articles.addToFavorites(article.id, {
          title: article.title,
          url: article.url,
          description: article.description,
          feedTitle: article.feedTitle,
          imageUrl: article.imageUrl,
        })
        if (!response.success) {
          // Rollback
          setFavoritedArticles(prev => {
            const newSet = new Set(prev)
            newSet.delete(article.id)
            return newSet
          })
          setFavorites(prev => prev.filter(f => f.articleId !== article.id))
          throw new Error(response.error)
        }
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err)
    }
  }, [getApi, favoritedArticles, fetchFavorites])

  // Add feed
  const addFeed = useCallback(async (url) => {
    try {
      const api = getApi()
      const response = await api.feeds.add(url)

      if (response.success) {
        await fetchFeeds()
        return { success: true, feed: response.data.feed }
      } else {
        throw new Error(response.error)
      }
    } catch (err) {
      console.error('Failed to add feed:', err)
      return { success: false, error: err.message }
    }
  }, [getApi, fetchFeeds])

  // Delete feed
  const deleteFeed = useCallback(async (feedId) => {
    try {
      const api = getApi()
      const response = await api.feeds.delete(feedId)

      if (response.success) {
        setFeeds(prev => prev.filter(f => f.id !== feedId))
        // Also remove articles from this feed
        setArticles(prev => prev.filter(a => a.feedId !== feedId))
        return { success: true }
      } else {
        throw new Error(response.error)
      }
    } catch (err) {
      console.error('Failed to delete feed:', err)
      return { success: false, error: err.message }
    }
  }, [getApi])

  // Get unread count
  const getUnreadCount = useCallback(() => {
    return articles.filter(article => !readArticles.has(article.id)).length
  }, [articles, readArticles])

  // Reset all state (used after Clear All Data)
  const resetAll = useCallback(() => {
    setFeeds([])
    setArticles([])
    setReadArticles(new Set())
    setFavoritedArticles(new Set())
    setFavorites([])
    setHasMore(true)
    setError(null)
  }, [])

  return (
    <FeedsContext.Provider
      value={{
        // State
        feeds,
        articles,
        readArticles,
        favoritedArticles,
        favorites,
        isLoading,
        isRefreshing,
        error,
        hasMore,
        // Actions
        fetchFeeds,
        fetchArticles,
        refreshAll,
        markAsRead,
        batchMarkAsRead,
        toggleFavorite,
        fetchFavorites,
        addFeed,
        deleteFeed,
        getUnreadCount,
        resetAll,
        // Setters (for direct manipulation if needed)
        setArticles,
        setFeeds,
      }}
    >
      {children}
    </FeedsContext.Provider>
  )
}
