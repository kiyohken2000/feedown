import React, { createContext, useState, useContext, useCallback } from 'react'
import { UserContext } from './UserContext'
import { createApiClient } from '../utils/api'

export const FeedsContext = createContext()

export const FeedsContextProvider = ({ children }) => {
  const { getAccessToken } = useContext(UserContext)

  // State
  const [feeds, setFeeds] = useState([])
  const [articles, setArticles] = useState([])
  const [readArticles, setReadArticles] = useState(new Set())
  const [favoritedArticles, setFavoritedArticles] = useState(new Set())
  const [favorites, setFavorites] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(true)

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
        setFeeds(response.data.feeds || [])
        return response.data.feeds || []
      } else {
        throw new Error(response.error)
      }
    } catch (err) {
      console.error('Failed to fetch feeds:', err)
      setError(err.message)
      return []
    }
  }, [getApi])

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
        const readSet = reset ? new Set() : new Set(readArticles)
        newArticles.forEach(article => {
          if (article.isRead) {
            readSet.add(article.id)
          }
        })
        setReadArticles(readSet)

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

  // Refresh all feeds (fetch RSS and update articles)
  const refreshAll = useCallback(async () => {
    try {
      setIsRefreshing(true)
      setError(null)

      const api = getApi()
      const refreshResponse = await api.refresh.refreshAll()

      if (refreshResponse.success) {
        const stats = refreshResponse.data.stats
        console.log(`Refresh complete: ${stats?.successfulFeeds}/${stats?.totalFeeds} feeds, ${stats?.newArticles} new articles`)

        // Update feeds if returned
        if (refreshResponse.data.feeds) {
          setFeeds(refreshResponse.data.feeds)
        } else {
          await fetchFeeds()
        }

        // Fetch articles after refresh
        await fetchArticles(true)

        return { success: true, stats }
      } else {
        throw new Error(refreshResponse.error)
      }
    } catch (err) {
      console.error('Failed to refresh:', err)
      setError(err.message)
      // On error, still try to fetch existing data
      await fetchFeeds()
      await fetchArticles(true)
      return { success: false, error: err.message }
    } finally {
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
        // Setters (for direct manipulation if needed)
        setArticles,
        setFeeds,
      }}
    >
      {children}
    </FeedsContext.Provider>
  )
}
