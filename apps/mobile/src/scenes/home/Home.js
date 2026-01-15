import React, { useContext, useEffect, useCallback, useState, useMemo, useRef } from 'react'
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { colors, fontSize, getThemeColors } from '../../theme'
import { FeedsContext } from '../../contexts/FeedsContext'
import { UserContext } from '../../contexts/UserContext'
import { useTheme } from '../../contexts/ThemeContext'
import ScreenTemplate from '../../components/ScreenTemplate'
import { showToast, showErrorToast } from '../../utils/showToast'

export default function Home() {
  const navigation = useNavigation()
  const { user } = useContext(UserContext)
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)
  const {
    articles,
    readArticles,
    feeds,
    isLoading,
    isRefreshing,
    error,
    hasMore,
    refreshAll,
    fetchArticles,
    markAsRead,
    batchMarkAsRead,
  } = useContext(FeedsContext)

  const [filter, setFilter] = useState('all') // 'all', 'unread', 'read'
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false)
  const isFirstFocus = useRef(true)
  const fetchArticlesRef = useRef(fetchArticles)

  // Keep ref updated with latest fetchArticles
  useEffect(() => {
    fetchArticlesRef.current = fetchArticles
  }, [fetchArticles])

  // Initial load
  useEffect(() => {
    if (user) {
      refreshAll()
    }
  }, [user])

  // Refresh when tab is focused (fixes stale data after Clear All Data)
  useFocusEffect(
    useCallback(() => {
      // Skip first focus (already handled by initial load)
      if (isFirstFocus.current) {
        isFirstFocus.current = false
        return
      }
      // Refresh articles when returning to this tab
      if (user) {
        fetchArticlesRef.current(true)
      }
    }, [user])
  )

  // Show error toast
  useEffect(() => {
    if (error) {
      showErrorToast({ title: 'Error', body: error })
    }
  }, [error])

  // Filter articles based on selected filter
  const filteredArticles = useMemo(() => {
    if (filter === 'all') {
      return articles
    } else if (filter === 'unread') {
      return articles.filter(article => !readArticles.has(article.id))
    } else if (filter === 'read') {
      return articles.filter(article => readArticles.has(article.id))
    }
    return articles
  }, [articles, filter, readArticles])

  // Calculate unread count
  const unreadCount = useMemo(() => {
    return articles.filter(a => !readArticles.has(a.id)).length
  }, [articles, readArticles])

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    await refreshAll()
  }, [refreshAll])

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoading && !isRefreshing) {
      fetchArticles(false)
    }
  }, [hasMore, isLoading, isRefreshing, fetchArticles])

  // Handle mark all as read
  const handleMarkAllRead = useCallback(async () => {
    if (unreadCount === 0) return

    const unreadArticleIds = articles
      .filter(article => !readArticles.has(article.id))
      .map(a => a.id)

    if (unreadArticleIds.length === 0) return

    setIsMarkingAllRead(true)
    try {
      await batchMarkAsRead(unreadArticleIds)
      showToast({ title: 'Done', body: `Marked ${unreadArticleIds.length} articles as read` })
    } catch (err) {
      showErrorToast({ title: 'Error', body: 'Failed to mark all as read' })
    } finally {
      setIsMarkingAllRead(false)
    }
  }, [articles, readArticles, unreadCount, batchMarkAsRead])

  // Navigate to article detail
  const handleArticlePress = useCallback((article) => {
    navigation.navigate('ArticleDetail', { article })
  }, [navigation])

  // Get relative time string
  const getRelativeTime = (dateString) => {
    if (!dateString) return ''

    const now = new Date()
    const date = new Date(dateString)
    const diffInSeconds = Math.floor((now - date) / 1000)

    if (diffInSeconds < 60) {
      return 'just now'
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${minutes}m`
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return `${hours}h`
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400)
      return `${days}d`
    } else {
      return date.toLocaleDateString()
    }
  }

  // Get feed by ID
  const getFeed = (feedId) => {
    return feeds.find(f => f.id === feedId)
  }

  // Render article item
  const renderArticle = ({ item: article }) => {
    const isRead = readArticles.has(article.id)
    const feed = getFeed(article.feedId)

    return (
      <TouchableOpacity
        style={[styles.articleCard, { backgroundColor: theme.card }, isRead && styles.articleCardRead]}
        onPress={() => handleArticlePress(article)}
        activeOpacity={0.7}
      >
        {article.imageUrl ? (
          <Image
            source={{ uri: article.imageUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.noThumbnail, { backgroundColor: theme.border }]}>
            <Text style={[styles.noThumbnailText, { color: theme.textMuted }]}>No image</Text>
          </View>
        )}
        <View style={styles.articleContent}>
          <View style={styles.articleMeta}>
            {feed?.faviconUrl && (
              <Image
                source={{ uri: feed.faviconUrl }}
                style={styles.favicon}
              />
            )}
            <Text style={styles.feedTitle} numberOfLines={1}>
              {article.feedTitle || 'Unknown Feed'}
            </Text>
            <Text style={[styles.dot, { color: theme.textMuted }]}>-</Text>
            <Text style={[styles.time, { color: theme.textMuted }]}>{getRelativeTime(article.publishedAt)}</Text>
          </View>
          <Text style={[styles.articleTitle, { color: theme.text }]} numberOfLines={2}>
            {article.title}
          </Text>
          <Text style={[styles.articleDescription, { color: theme.textSecondary }]} numberOfLines={2}>
            {article.description || ''}
          </Text>
          {!isRead && (
            <TouchableOpacity
              style={[styles.markReadButton, { backgroundColor: theme.border }]}
              onPress={(e) => {
                e.stopPropagation()
                markAsRead(article.id)
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.markReadButtonText, { color: theme.textMuted }]}>Mark as Read</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  // Render footer (loading more)
  const renderFooter = () => {
    if (!hasMore) {
      return filteredArticles.length > 0 ? (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textMuted }]}>No more articles</Text>
        </View>
      ) : null
    }

    if (isLoading && filteredArticles.length > 0) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )
    }

    return null
  }

  // Render empty state
  const renderEmpty = () => {
    if (isLoading || isRefreshing) return null

    if (filter === 'unread' && articles.length > 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>All caught up!</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No unread articles. Pull to refresh for new content.
          </Text>
        </View>
      )
    }

    if (filter === 'read' && articles.length > 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No read articles</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Articles you've read will appear here.
          </Text>
        </View>
      )
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>No articles yet</Text>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          Add some feeds in the Feeds tab to get started
        </Text>
      </View>
    )
  }

  return (
    <ScreenTemplate>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={styles.headerTitle}>FeedOwn</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{unreadCount} unread</Text>
          </View>
        )}
      </View>

      {/* Filter and Actions Bar */}
      <View style={[styles.filterBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View style={styles.filterButtons}>
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: theme.card }, filter === 'all' && styles.filterButtonActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterButtonText, filter === 'all' && styles.filterButtonTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: theme.card }, filter === 'unread' && styles.filterButtonActive]}
            onPress={() => setFilter('unread')}
          >
            <Text style={[styles.filterButtonText, filter === 'unread' && styles.filterButtonTextActive]}>
              Unread
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: theme.card }, filter === 'read' && styles.filterButtonActive]}
            onPress={() => setFilter('read')}
          >
            <Text style={[styles.filterButtonText, filter === 'read' && styles.filterButtonTextActive]}>
              Read
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.markAllButton, (unreadCount === 0 || isMarkingAllRead) && styles.markAllButtonDisabled]}
          onPress={handleMarkAllRead}
          disabled={unreadCount === 0 || isMarkingAllRead}
        >
          {isMarkingAllRead ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.markAllButtonText}>Mark All Read</Text>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredArticles}
        renderItem={renderArticle}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />

      {isLoading && articles.length === 0 && (
        <View style={[styles.loadingOverlay, { backgroundColor: isDarkMode ? 'rgba(18, 18, 18, 0.9)' : 'rgba(255, 255, 255, 0.9)' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading articles...</Text>
        </View>
      )}
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  headerTitle: {
    fontSize: fontSize.xxLarge,
    fontWeight: 'bold',
    color: colors.primary,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  unreadText: {
    color: colors.white,
    fontSize: fontSize.small,
    fontWeight: '600',
  },
  // Filter bar
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
    backgroundColor: colors.white,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterButtonText: {
    fontSize: fontSize.small,
    fontWeight: '600',
    color: colors.primary,
  },
  filterButtonTextActive: {
    color: colors.white,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#28a745',
    minWidth: 100,
    alignItems: 'center',
  },
  markAllButtonDisabled: {
    backgroundColor: colors.gray,
    opacity: 0.6,
  },
  markAllButtonText: {
    fontSize: fontSize.small,
    fontWeight: '600',
    color: colors.white,
  },
  // List
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexGrow: 1,
  },
  articleCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    marginVertical: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  articleCardRead: {
    opacity: 0.6,
  },
  thumbnail: {
    width: '100%',
    height: 160,
    backgroundColor: colors.grayLight,
  },
  noThumbnail: {
    width: '100%',
    height: 80,
    backgroundColor: colors.grayLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noThumbnailText: {
    color: colors.gray,
    fontSize: fontSize.small,
  },
  articleContent: {
    padding: 12,
  },
  articleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  favicon: {
    width: 14,
    height: 14,
    borderRadius: 2,
    marginRight: 6,
  },
  feedTitle: {
    color: colors.primary,
    fontSize: fontSize.small,
    fontWeight: '600',
    flex: 1,
  },
  dot: {
    color: colors.gray,
    marginHorizontal: 6,
  },
  time: {
    color: colors.gray,
    fontSize: fontSize.small,
  },
  articleTitle: {
    fontSize: fontSize.large,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 4,
    lineHeight: 22,
  },
  articleDescription: {
    fontSize: fontSize.normal,
    color: colors.gray,
    lineHeight: 20,
  },
  markReadButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.grayLight,
    borderRadius: 4,
  },
  markReadButtonText: {
    fontSize: fontSize.small,
    color: colors.gray,
    fontWeight: '500',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    color: colors.gray,
    fontSize: fontSize.small,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: fontSize.xLarge,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: fontSize.normal,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  loadingText: {
    marginTop: 12,
    fontSize: fontSize.normal,
    color: colors.gray,
  },
})
