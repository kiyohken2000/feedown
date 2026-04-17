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
  Animated,
  PanResponder,
  Vibration,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { Dropdown } from 'react-native-element-dropdown'
import { colors, fontSize, getThemeColors } from '../../theme'
import { FeedsContext } from '../../contexts/FeedsContext'
import { UserContext } from '../../contexts/UserContext'
import { useTheme } from '../../contexts/ThemeContext'
import ScreenTemplate from '../../components/ScreenTemplate'
import { showToast, showErrorToast } from '../../utils/showToast'

// スワイプ可能な記事アイテムコンポーネント
const SwipeableArticleItem = ({ article, isRead, feed, onPress, onLongPress, isSelectionMode, isChecked, onToggleCheck, onMarkRead, onReadLater, isReadLater, theme, isDarkMode }) => {
  const translateX = useRef(new Animated.Value(0)).current
  const swipeActionRef = useRef(null)

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isSelectionMode,
      onMoveShouldSetPanResponder: (_, gs) => !isSelectionMode && Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderMove: (_, gs) => {
        translateX.setValue(gs.dx)
      },
      onPanResponderRelease: (_, gs) => {
        const threshold = 80
        if (gs.dx > threshold) {
          // 右スワイプ → 既読
          swipeActionRef.current = 'read'
          Animated.timing(translateX, { toValue: 400, duration: 200, useNativeDriver: true }).start(() => {
            onMarkRead(article.id)
            translateX.setValue(0)
          })
        } else if (gs.dx < -threshold) {
          // 左スワイプ → Read Later
          swipeActionRef.current = 'later'
          Animated.timing(translateX, { toValue: -400, duration: 200, useNativeDriver: true }).start(() => {
            onReadLater(article)
            translateX.setValue(0)
          })
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start()
        }
      },
    })
  ).current

  // スワイプ背景色
  const bgColorLeft = translateX.interpolate({
    inputRange: [-200, 0],
    outputRange: ['#6f42c1', 'transparent'],
    extrapolate: 'clamp',
  })
  const bgColorRight = translateX.interpolate({
    inputRange: [0, 200],
    outputRange: ['transparent', '#28a745'],
    extrapolate: 'clamp',
  })

  return (
    <View style={{ overflow: 'hidden', marginVertical: 6, marginHorizontal: 12 }}>
      {/* スワイプ背景 */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { borderRadius: 12, backgroundColor: bgColorLeft }]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 20 }}>
          <Text style={{ color: 'white', fontSize: 13, fontWeight: '700' }}>📌 Read Later</Text>
        </View>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFillObject, { borderRadius: 12, backgroundColor: bgColorRight }]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 20 }}>
          <Text style={{ color: 'white', fontSize: 13, fontWeight: '700' }}>✓ 既読</Text>
        </View>
      </Animated.View>

      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={[
            styles.articleCard,
            { backgroundColor: theme.card },
            isRead && styles.articleCardRead,
            isChecked && { borderColor: colors.primary, borderWidth: 2 },
          ]}
          onPress={() => isSelectionMode ? onToggleCheck(article.id) : onPress(article)}
          onLongPress={() => onLongPress(article)}
          activeOpacity={0.7}
        >
          {/* 選択モードのチェックボックス */}
          {isSelectionMode && (
            <TouchableOpacity
              onPress={() => onToggleCheck(article.id)}
              style={styles.checkboxContainer}
            >
              <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                {isChecked && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
          )}

          {article.imageUrl ? (
            <Image source={{ uri: article.imageUrl }} style={styles.thumbnail} resizeMode="cover" />
          ) : (
            <View style={[styles.noThumbnail, { backgroundColor: theme.border }]}>
              <Text style={[styles.noThumbnailText, { color: theme.textMuted }]}>No image</Text>
            </View>
          )}

          <View style={styles.articleContent}>
            <View style={styles.articleMeta}>
              {feed?.faviconUrl && (
                <Image source={{ uri: feed.faviconUrl }} style={styles.favicon} />
              )}
              <Text style={[styles.feedTitleText, { flex: 1 }]} numberOfLines={1}>
                {article.feedTitle || 'Unknown Feed'}
              </Text>
              {isReadLater && <Text style={styles.readLaterBadge}>📌</Text>}
              <Text style={[styles.dot, { color: theme.textMuted }]}>-</Text>
              <Text style={[styles.time, { color: theme.textMuted }]}>{getRelativeTime(article.publishedAt)}</Text>
            </View>
            <Text style={[styles.articleTitle, { color: theme.text }]} numberOfLines={2}>
              {article.title}
            </Text>
            <Text style={[styles.articleDescription, { color: theme.textSecondary }]} numberOfLines={2}>
              {article.description || ''}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

function getRelativeTime(dateString) {
  if (!dateString) return ''
  const now = new Date()
  const date = new Date(dateString)
  const diffInSeconds = Math.floor((now - date) / 1000)
  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`
  return date.toLocaleDateString()
}

export default function Home() {
  const navigation = useNavigation()
  const { user, getAccessToken } = useContext(UserContext)
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)
  const {
    articles, readArticles, feeds,
    isLoading, isRefreshing, error, hasMore,
    refreshAll, fetchArticles, markAsRead, batchMarkAsRead,
  } = useContext(FeedsContext)

  const [filter, setFilter] = useState('all')
  const [selectedFeedId, setSelectedFeedId] = useState(null)
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [readLaterIds, setReadLaterIds] = useState(new Set())
  const [isMarkingSelected, setIsMarkingSelected] = useState(false)

  const isFirstFocus = useRef(true)
  const fetchArticlesRef = useRef(fetchArticles)
  const flatListRef = useRef(null)

  useEffect(() => { fetchArticlesRef.current = fetchArticles }, [fetchArticles])

  // Read Later API
  const callReadLaterAPI = useCallback(async (method, body = null, query = '') => {
    const token = await getAccessToken()
    const baseUrl = '' // config.jsから取得するか直接指定
    const res = await fetch(`${baseUrl}/api/read-later${query}`, {
      method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    return res.json()
  }, [getAccessToken])

  // Read Later一覧取得
  useEffect(() => {
    if (!user) return
    callReadLaterAPI('GET').then(data => {
      if (data.success) {
        setReadLaterIds(new Set(data.data.articles.map(a => a.article_id)))
      }
    }).catch(console.error)
  }, [user, callReadLaterAPI])

  // タブタップでトップへ
  useEffect(() => {
    const unsub = navigation.getParent()?.addListener('tabPress', () => {
      if (navigation.isFocused()) {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true })
      }
    })
    return unsub
  }, [navigation])

  useEffect(() => { if (user) refreshAll() }, [user])

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) { isFirstFocus.current = false; return }
      if (user) fetchArticlesRef.current(true)
    }, [user])
  )

  useEffect(() => { if (error) showErrorToast({ title: 'Error', body: error }) }, [error])

  const feedOptions = useMemo(() => {
    const opts = [{ label: 'All Feeds', value: null }]
    feeds.forEach(f => opts.push({ label: f.title || f.url, value: f.id }))
    return opts
  }, [feeds])

  const filteredArticles = useMemo(() => {
    let result = articles
    if (selectedFeedId) result = result.filter(a => a.feedId === selectedFeedId)
    if (filter === 'unread') result = result.filter(a => !readArticles.has(a.id))
    else if (filter === 'read') result = result.filter(a => readArticles.has(a.id))
    return result
  }, [articles, filter, readArticles, selectedFeedId])

  const unreadCount = useMemo(() =>
    articles.filter(a => !readArticles.has(a.id)).length,
    [articles, readArticles]
  )

  const allSelected = filteredArticles.length > 0 && selectedIds.size === filteredArticles.length

  // 長押し → 選択モード開始
  const handleLongPress = useCallback((article) => {
    Vibration.vibrate(50)
    setSelectionMode(true)
    setSelectedIds(new Set([article.id]))
  }, [])

  const handleToggleCheck = useCallback((articleId) => {
    setSelectedIds(prev => {
      const s = new Set(prev)
      s.has(articleId) ? s.delete(articleId) : s.add(articleId)
      return s
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredArticles.map(a => a.id)))
    }
  }, [allSelected, filteredArticles])

  const handleExitSelection = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }, [])

  // 選択項目を既読に
  const handleMarkSelectedRead = useCallback(async () => {
    if (!selectedIds.size) return
    const ids = [...selectedIds]
    setIsMarkingSelected(true)
    try {
      await batchMarkAsRead(ids)
      showToast({ title: 'Done', body: `${ids.length}件を既読にしました` })
      setSelectionMode(false)
      setSelectedIds(new Set())
    } catch (e) {
      showErrorToast({ title: 'Error', body: 'Failed to mark as read' })
    } finally {
      setIsMarkingSelected(false)
    }
  }, [selectedIds, batchMarkAsRead])

  // 選択項目をRead Laterに
  const handleMarkSelectedReadLater = useCallback(async () => {
    if (!selectedIds.size) return
    const ids = [...selectedIds]
    try {
      for (const id of ids) {
        const article = articles.find(a => a.id === id)
        if (article && !readLaterIds.has(id)) {
          await callReadLaterAPI('POST', {
            articleId: id,
            title: article.title,
            url: article.url,
            description: article.description,
            feedTitle: article.feedTitle,
            imageUrl: article.imageUrl,
          })
        }
      }
      setReadLaterIds(prev => { const s = new Set(prev); ids.forEach(id => s.add(id)); return s })
      showToast({ title: 'Read Later', body: `${ids.length}件をRead Laterに追加しました` })
      setSelectionMode(false)
      setSelectedIds(new Set())
    } catch (e) {
      showErrorToast({ title: 'Error', body: 'Failed to add to Read Later' })
    }
  }, [selectedIds, articles, readLaterIds, callReadLaterAPI])

  // スワイプで既読
  const handleSwipeMarkRead = useCallback((articleId) => {
    markAsRead(articleId)
    showToast({ title: '✓ 既読', body: '' })
  }, [markAsRead])

  // スワイプでRead Later
  const handleSwipeReadLater = useCallback(async (article) => {
    if (readLaterIds.has(article.id)) {
      await callReadLaterAPI('DELETE', null, `?articleId=${encodeURIComponent(article.id)}`)
      setReadLaterIds(prev => { const s = new Set(prev); s.delete(article.id); return s })
      showToast({ title: 'Read Later削除', body: '' })
    } else {
      await callReadLaterAPI('POST', {
        articleId: article.id, title: article.title, url: article.url,
        description: article.description, feedTitle: article.feedTitle, imageUrl: article.imageUrl,
      })
      setReadLaterIds(prev => new Set([...prev, article.id]))
      showToast({ title: '📌 Read Later追加', body: '' })
    }
  }, [readLaterIds, callReadLaterAPI])

  const handleRefresh = useCallback(async () => { await refreshAll() }, [refreshAll])

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoading && !isRefreshing) fetchArticles(false)
  }, [hasMore, isLoading, isRefreshing, fetchArticles])

  const handleMarkAllRead = useCallback(async () => {
    if (unreadCount === 0) return
    const ids = articles.filter(a => !readArticles.has(a.id)).map(a => a.id)
    setIsMarkingAllRead(true)
    try {
      await batchMarkAsRead(ids)
      showToast({ title: 'Done', body: `${ids.length}件を既読にしました` })
    } catch (e) {
      showErrorToast({ title: 'Error', body: 'Failed' })
    } finally {
      setIsMarkingAllRead(false)
    }
  }, [articles, readArticles, unreadCount, batchMarkAsRead])

  const renderArticle = ({ item: article }) => {
    const isRead = readArticles.has(article.id)
    const feed = feeds.find(f => f.id === article.feedId)
    const isChecked = selectedIds.has(article.id)
    const isReadLater = readLaterIds.has(article.id)

    return (
      <SwipeableArticleItem
        article={article}
        isRead={isRead}
        feed={feed}
        onPress={art => navigation.navigate('ArticleDetail', { article: art })}
        onLongPress={handleLongPress}
        isSelectionMode={selectionMode}
        isChecked={isChecked}
        onToggleCheck={handleToggleCheck}
        onMarkRead={handleSwipeMarkRead}
        onReadLater={handleSwipeReadLater}
        isReadLater={isReadLater}
        theme={theme}
        isDarkMode={isDarkMode}
      />
    )
  }

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

  const renderEmpty = () => {
    if (isLoading || isRefreshing) return null
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          {filter === 'unread' && articles.length > 0 ? 'All caught up!' :
           filter === 'read' && articles.length > 0 ? 'No read articles' : 'No articles yet'}
        </Text>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          Pull down to refresh.
        </Text>
      </View>
    )
  }

  return (
    <ScreenTemplate>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={styles.headerTitle}>FeedOwn</Text>
        <View style={styles.headerRight}>
          <Dropdown
            style={[styles.feedDropdown, { backgroundColor: theme.card, borderColor: theme.border }]}
            placeholderStyle={[styles.feedDropdownText, { color: theme.text }]}
            selectedTextStyle={[styles.feedDropdownText, { color: theme.text }]}
            containerStyle={[styles.feedDropdownList, { backgroundColor: theme.card }]}
            itemTextStyle={{ color: theme.text }}
            activeColor={isDarkMode ? '#333' : '#f0f0f0'}
            data={feedOptions}
            maxHeight={300}
            labelField="label"
            valueField="value"
            placeholder="All Feeds"
            value={selectedFeedId}
            onChange={item => setSelectedFeedId(item.value)}
          />
          <View style={[styles.unreadBadge, unreadCount === 0 && styles.allReadBadge]}>
            <Text style={styles.unreadText}>
              {unreadCount > 0 ? `${unreadCount} unread` : 'All read'}
            </Text>
          </View>
        </View>
      </View>

      {/* 選択モードバー */}
      {selectionMode ? (
        <View style={[styles.selectionBar, { backgroundColor: isDarkMode ? '#2d2d2d' : '#fff3e0', borderBottomColor: theme.border }]}>
          {/* 全選択チェックボックス */}
          <TouchableOpacity onPress={handleSelectAll} style={styles.selectAllButton}>
            <View style={[styles.checkbox, allSelected && styles.checkboxChecked]}>
              {allSelected && <Text style={styles.checkmark}>✓</Text>}
              {!allSelected && selectedIds.size > 0 && <Text style={[styles.checkmark, { color: colors.primary }]}>−</Text>}
            </View>
            <Text style={[styles.selectAllText, { color: theme.text }]}>
              {selectedIds.size > 0 ? `${selectedIds.size}件選択` : '全選択'}
            </Text>
          </TouchableOpacity>

          <View style={styles.selectionActions}>
            {/* Read Laterボタン */}
            <TouchableOpacity
              onPress={handleMarkSelectedReadLater}
              disabled={selectedIds.size === 0}
              style={[styles.selectionActionBtn, styles.readLaterBtn, selectedIds.size === 0 && styles.disabledBtn]}
            >
              <Text style={styles.selectionActionText}>📌 Read Later</Text>
            </TouchableOpacity>

            {/* 既読ボタン */}
            <TouchableOpacity
              onPress={handleMarkSelectedRead}
              disabled={selectedIds.size === 0 || isMarkingSelected}
              style={[styles.selectionActionBtn, styles.markReadBtn, selectedIds.size === 0 && styles.disabledBtn]}
            >
              {isMarkingSelected ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.selectionActionText}>✓ 既読</Text>
              )}
            </TouchableOpacity>

            {/* キャンセル */}
            <TouchableOpacity onPress={handleExitSelection} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: theme.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* 通常フィルターバー */
        <View style={[styles.filterBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <View style={styles.filterButtons}>
            {['all', 'unread', 'read'].map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.filterButton, { backgroundColor: theme.card }, filter === f && styles.filterButtonActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterButtonText, filter === f && styles.filterButtonTextActive]}>
                  {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : 'Read'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.markAllButton, (unreadCount === 0 || isMarkingAllRead) && styles.markAllButtonDisabled]}
            onPress={handleMarkAllRead}
            disabled={unreadCount === 0 || isMarkingAllRead}
          >
            {isMarkingAllRead ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.markAllButtonText}>All Read</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* スワイプヒント */}
      {!selectionMode && (
        <View style={[styles.swipeHint, { backgroundColor: theme.surface }]}>
          <Text style={[styles.swipeHintText, { color: theme.textMuted }]}>
            右スワイプ：既読　左スワイプ：Read Later　長押し：選択モード
          </Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={filteredArticles}
        renderItem={renderArticle}
        keyExtractor={item => item.id}
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
        <View style={[styles.loadingOverlay, { backgroundColor: isDarkMode ? 'rgba(18,18,18,0.9)' : 'rgba(255,255,255,0.9)' }]}>
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
  },
  headerTitle: {
    fontSize: fontSize.xxLarge,
    fontWeight: 'bold',
    color: colors.primary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  feedDropdown: {
    width: 120, height: 32, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8,
  },
  feedDropdownText: { fontSize: fontSize.small },
  feedDropdownList: { borderRadius: 8, marginTop: 4, width: 180, marginLeft: -60 },
  unreadBadge: {
    backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  allReadBadge: { backgroundColor: '#28a745' },
  unreadText: { color: colors.white, fontSize: fontSize.small, fontWeight: '600' },

  // 選択モードバー
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
  },
  selectAllText: {
    fontSize: fontSize.small,
    fontWeight: '600',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
  },
  selectionActions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  selectionActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readLaterBtn: { backgroundColor: '#6f42c1' },
  markReadBtn: { backgroundColor: '#28a745' },
  disabledBtn: { opacity: 0.5 },
  selectionActionText: {
    color: 'white',
    fontSize: fontSize.small,
    fontWeight: '700',
  },
  cancelBtn: {
    padding: 6,
  },
  cancelText: {
    fontSize: 18,
    fontWeight: '700',
  },

  // フィルターバー
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  filterButtons: { flexDirection: 'row', gap: 6 },
  filterButton: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: colors.primary,
  },
  filterButtonActive: { backgroundColor: colors.primary },
  filterButtonText: { fontSize: fontSize.small, fontWeight: '600', color: colors.primary },
  filterButtonTextActive: { color: colors.white },
  markAllButton: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    backgroundColor: '#28a745', minWidth: 80, alignItems: 'center',
  },
  markAllButtonDisabled: { backgroundColor: colors.gray, opacity: 0.6 },
  markAllButtonText: { fontSize: fontSize.small, fontWeight: '600', color: colors.white },

  // スワイプヒント
  swipeHint: {
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  swipeHintText: {
    fontSize: 11,
    textAlign: 'center',
  },

  // 記事カード
  listContent: { paddingVertical: 8, flexGrow: 1 },
  articleCard: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    padding: 12,
    backgroundColor: colors.white,
  },
  articleCardRead: { opacity: 0.6 },
  checkboxContainer: {
    justifyContent: 'center',
    marginRight: 10,
  },
  thumbnail: {
    width: 80, height: 80, backgroundColor: colors.grayLight, borderRadius: 8,
  },
  noThumbnail: {
    width: 80, height: 80, backgroundColor: colors.grayLight, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  noThumbnailText: { color: colors.gray, fontSize: fontSize.xSmall },
  articleContent: { flex: 1, marginLeft: 10, justifyContent: 'center' },
  articleMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  favicon: { width: 14, height: 14, borderRadius: 2, marginRight: 6 },
  feedTitleText: { color: colors.primary, fontSize: fontSize.small, fontWeight: '600' },
  readLaterBadge: { fontSize: 12, marginHorizontal: 4 },
  dot: { color: colors.gray, marginHorizontal: 4 },
  time: { color: colors.gray, fontSize: fontSize.small },
  articleTitle: {
    fontSize: fontSize.normal, fontWeight: '600', color: colors.black,
    marginBottom: 4, lineHeight: 20,
  },
  articleDescription: {
    fontSize: fontSize.small, color: colors.gray, lineHeight: 18,
  },
  footer: { paddingVertical: 20, alignItems: 'center' },
  footerText: { color: colors.gray, fontSize: fontSize.small },
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 40, paddingTop: 100,
  },
  emptyTitle: {
    fontSize: fontSize.xLarge, fontWeight: '600', color: colors.black, marginBottom: 8,
  },
  emptyText: {
    fontSize: fontSize.normal, color: colors.gray, textAlign: 'center', lineHeight: 22,
  },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  loadingText: { marginTop: 12, fontSize: fontSize.normal },
})
