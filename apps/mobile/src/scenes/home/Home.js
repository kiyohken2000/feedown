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
import { useAsyncStorageState } from '../../utils/useAsyncStorageState'

// スワイプ可能な記事アイテム（カード・リスト・マガジン表示対応）
const SwipeableArticleItem = ({ article, isRead, feed, onPress, onLongPress, isSelectionMode, isChecked, onToggleCheck, onMarkRead, onReadLater, isReadLater, theme, isDarkMode, viewMode }) => {
  const translateX = useRef(new Animated.Value(0)).current

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isSelectionMode,
      onMoveShouldSetPanResponder: (_, gs) => !isSelectionMode && Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderMove: (_, gs) => translateX.setValue(gs.dx),
      onPanResponderRelease: (_, gs) => {
        const threshold = 80
        if (gs.dx > threshold) {
          Animated.timing(translateX, { toValue: 400, duration: 200, useNativeDriver: true }).start(() => {
            onMarkRead(article.id)
            translateX.setValue(0)
          })
        } else if (gs.dx < -threshold) {
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

  const bgColorLeft = translateX.interpolate({
    inputRange: [-200, 0], outputRange: ['#6f42c1', 'transparent'], extrapolate: 'clamp',
  })
  const bgColorRight = translateX.interpolate({
    inputRange: [0, 200], outputRange: ['transparent', '#28a745'], extrapolate: 'clamp',
  })

  const isListMode = viewMode === 'list'
  const isMagazineMode = viewMode === 'magazine'
  const checkColor = isDarkMode ? '#555' : '#888'

  return (
    <View style={{ overflow: 'hidden', marginVertical: isListMode ? 2 : 6, marginHorizontal: isListMode ? 0 : 12 }}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { borderRadius: isListMode ? 0 : 12, backgroundColor: bgColorLeft }]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 20 }}>
          <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>📌 Read Later</Text>
        </View>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFillObject, { borderRadius: isListMode ? 0 : 12, backgroundColor: bgColorRight }]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 20 }}>
          <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>✓ 既読</Text>
        </View>
      </Animated.View>

      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <TouchableOpacity
          style={[
            isListMode ? styles.articleListRow : isMagazineMode ? styles.articleMagazine : styles.articleCard,
            { backgroundColor: theme.card },
            isRead && styles.articleCardRead,
            isChecked && { borderColor: checkColor, borderWidth: 2 },
            isListMode && { borderBottomColor: theme.border, borderBottomWidth: 1 },
          ]}
          onPress={() => isSelectionMode ? onToggleCheck(article.id) : onPress(article)}
          onLongPress={() => onLongPress(article)}
          activeOpacity={0.7}
        >
          {isSelectionMode && (
            <TouchableOpacity onPress={() => onToggleCheck(article.id)} style={[styles.checkboxContainer, isMagazineMode && { position: 'absolute', top: 12, left: 12, zIndex: 10 }]}>
              <View style={[styles.checkbox, { borderColor: checkColor }, isChecked && { backgroundColor: checkColor }]}>
                {isChecked && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
          )}

          {!isListMode && (
            article.imageUrl ? (
              <Image source={{ uri: article.imageUrl }} style={isMagazineMode ? styles.thumbnailMagazine : styles.thumbnailCard} resizeMode="cover" />
            ) : (
              <View style={[isMagazineMode ? styles.noThumbnailMagazine : styles.noThumbnailCard, { backgroundColor: theme.border }]}>
                <Text style={[styles.noThumbnailText, { color: theme.textMuted }]}>No image</Text>
              </View>
            )
          )}

          <View style={[styles.articleContent, (isListMode || isMagazineMode) && { marginLeft: 0 }]}>
            <View style={styles.articleMeta}>
              {!isListMode && feed?.faviconUrl && (
                <Image source={{ uri: feed.faviconUrl }} style={styles.favicon} />
              )}
              {/* フィード名をモノトーンに変更 */}
              <Text style={[styles.feedTitleText, { color: theme.textSecondary, flex: 1 }]} numberOfLines={1}>
                {article.feedTitle || 'Unknown Feed'}
              </Text>
              {isReadLater && <Text style={styles.readLaterBadge}>📌</Text>}
              <Text style={[styles.dot, { color: theme.textMuted }]}>·</Text>
              <Text style={[styles.time, { color: theme.textMuted }]}>{getRelativeTime(article.publishedAt)}</Text>
            </View>
            <Text
              style={[styles.articleTitle, { color: theme.text }, isListMode && { fontSize: fontSize.normal }, isMagazineMode && { fontSize: fontSize.large, marginBottom: 6 }]}
              numberOfLines={isListMode ? 1 : 3}
            >
              {article.title}
            </Text>
            {!isListMode && (
              <Text style={[styles.articleDescription, { color: theme.textSecondary }]} numberOfLines={isMagazineMode ? 3 : 2}>
                {article.description || ''}
              </Text>
            )}
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
  const diff = Math.floor((now - date) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
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

  // 永続化された設定 (card | list | magazine)
  const [filter, setFilter] = useAsyncStorageState('@home_filter', 'all')
  const [viewMode, setViewMode] = useAsyncStorageState('@home_viewMode', 'card')

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
    const res = await fetch(`/api/read-later${query}`, {
      method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    return res.json()
  }, [getAccessToken])

  useEffect(() => {
    if (!user) return
    callReadLaterAPI('GET').then(data => {
      if (data.success) setReadLaterIds(new Set(data.data.articles.map(a => a.article_id)))
    }).catch(console.error)
  }, [user, callReadLaterAPI])

  useEffect(() => {
    const unsub = navigation.getParent()?.addListener('tabPress', () => {
      if (navigation.isFocused()) flatListRef.current?.scrollToOffset({ offset: 0, animated: true })
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
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(filteredArticles.map(a => a.id)))
  }, [allSelected, filteredArticles])

  const handleExitSelection = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }, [])

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

  const handleMarkSelectedReadLater = useCallback(async () => {
    if (!selectedIds.size) return
    const ids = [...selectedIds]
    try {
      for (const id of ids) {
        const article = articles.find(a => a.id === id)
        if (article && !readLaterIds.has(id)) {
          await callReadLaterAPI('POST', {
            articleId: id, title: article.title, url: article.url,
            description: article.description, feedTitle: article.feedTitle, imageUrl: article.imageUrl,
          })
        }
      }
      setReadLaterIds(prev => { const s = new Set(prev); ids.forEach(id => s.add(id)); return s })
      showToast({ title: 'Read Later', body: `${ids.length}件をRead Laterに追加しました` })
      setSelectionMode(false)
      setSelectedIds(new Set())
    } catch (e) {
      showErrorToast({ title: 'Error', body: 'Failed' })
    }
  }, [selectedIds, articles, readLaterIds, callReadLaterAPI])

  const handleSwipeMarkRead = useCallback((articleId) => {
    markAsRead(articleId)
    showToast({ title: '✓ 既読', body: '' })
  }, [markAsRead])

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
        viewMode={viewMode}
      />
    )
  }

  const renderFooter = () => {
    if (!hasMore) return filteredArticles.length > 0 ? (
      <View style={styles.footer}><Text style={[styles.footerText, { color: theme.textMuted }]}>No more articles</Text></View>
    ) : null
    if (isLoading && filteredArticles.length > 0) return (
      <View style={styles.footer}><ActivityIndicator size="small" color={isDarkMode ? '#888' : '#555'} /></View>
    )
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
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Pull down to refresh.</Text>
      </View>
    )
  }

  const activeColor = isDarkMode ? '#555' : '#888'
  const inactiveBorderColor = isDarkMode ? '#444' : '#ccc'

  return (
    <ScreenTemplate>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>FeedOwn</Text>
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
          {/* 未読バッジをモノトーンに */}
          <View style={[styles.unreadBadge, { backgroundColor: isDarkMode ? '#444' : '#bbb' }, unreadCount === 0 && styles.allReadBadge]}>
            <Text style={styles.unreadText}>{unreadCount > 0 ? `${unreadCount} unread` : 'All read'}</Text>
          </View>
        </View>
      </View>

      {/* 選択モードバー */}
      {selectionMode ? (
        <View style={[styles.selectionBar, { backgroundColor: isDarkMode ? '#2d2d2d' : '#f5f5f5', borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={handleSelectAll} style={styles.selectAllButton}>
            <View style={[styles.checkbox, { borderColor: activeColor }, allSelected && { backgroundColor: activeColor }]}>
              {allSelected && <Text style={styles.checkmark}>✓</Text>}
              {!allSelected && selectedIds.size > 0 && <Text style={[styles.checkmark, { color: activeColor }]}>−</Text>}
            </View>
            <Text style={[styles.selectAllText, { color: theme.text }]}>
              {selectedIds.size > 0 ? `${selectedIds.size}件選択` : '全選択'}
            </Text>
          </TouchableOpacity>
          <View style={styles.selectionActions}>
            <TouchableOpacity
              onPress={handleMarkSelectedReadLater}
              disabled={selectedIds.size === 0}
              style={[styles.selectionActionBtn, styles.readLaterBtn, selectedIds.size === 0 && styles.disabledBtn]}
            >
              <Text style={styles.selectionActionText}>📌 Read Later</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleMarkSelectedRead}
              disabled={selectedIds.size === 0 || isMarkingSelected}
              style={[styles.selectionActionBtn, styles.markReadBtn, selectedIds.size === 0 && styles.disabledBtn]}
            >
              {isMarkingSelected ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.selectionActionText}>✓ 既読</Text>}
            </TouchableOpacity>
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
                style={[
                  styles.filterButton,
                  { borderColor: filter === f ? activeColor : inactiveBorderColor },
                  filter === f && { backgroundColor: activeColor }
                ]}
                onPress={() => setFilter(f)}
              >
                <Text style={[
                  styles.filterButtonText,
                  { color: filter === f ? 'white' : theme.textSecondary }
                ]}>
                  {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : 'Read'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.rightButtons}>
            {/* 3段階の表示切替ボタン（Card → List → Magazine） */}
            <TouchableOpacity
              style={[styles.viewToggleBtn, { borderColor: theme.border }]}
              onPress={() => setViewMode(v => v === 'card' ? 'list' : v === 'list' ? 'magazine' : 'card')}
            >
              <Text style={[styles.viewToggleText, { color: theme.text }]}>
                {viewMode === 'card' ? '☰' : viewMode === 'list' ? '📰' : '⊞'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.markAllButton, (unreadCount === 0 || isMarkingAllRead) && styles.markAllButtonDisabled]}
              onPress={handleMarkAllRead}
              disabled={unreadCount === 0 || isMarkingAllRead}
            >
              {isMarkingAllRead ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.markAllButtonText}>All Read</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={filteredArticles}
        renderItem={renderArticle}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.listContent, viewMode === 'list' && { paddingHorizontal: 0, paddingVertical: 0 }]}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={isDarkMode ? '#888' : '#555'} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />

      {isLoading && articles.length === 0 && (
        <View style={[styles.loadingOverlay, { backgroundColor: isDarkMode ? 'rgba(18,18,18,0.9)' : 'rgba(255,255,255,0.9)' }]}>
          <ActivityIndicator size="large" color={isDarkMode ? '#888' : '#555'} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading articles...</Text>
        </View>
      )}
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: fontSize.xxLarge, fontWeight: 'bold' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feedDropdown: { width: 120, height: 32, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8 },
  feedDropdownText: { fontSize: fontSize.small },
  feedDropdownList: { borderRadius: 8, marginTop: 4, width: 180, marginLeft: -60 },
  unreadBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  allReadBadge: { backgroundColor: '#28a745' },
  unreadText: { color: 'white', fontSize: fontSize.small, fontWeight: '600' },

  selectionBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  selectAllButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 },
  selectAllText: { fontSize: fontSize.small, fontWeight: '600' },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: 'white', fontSize: 13, fontWeight: '700' },
  selectionActions: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  selectionActionBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  readLaterBtn: { backgroundColor: '#6f42c1' },
  markReadBtn: { backgroundColor: '#28a745' },
  disabledBtn: { opacity: 0.5 },
  selectionActionText: { color: 'white', fontSize: fontSize.small, fontWeight: '700' },
  cancelBtn: { padding: 6 },
  cancelText: { fontSize: 18, fontWeight: '700' },

  filterBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  filterButtons: { flexDirection: 'row', gap: 6 },
  filterButton: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  filterButtonText: { fontSize: fontSize.small, fontWeight: '600' },
  rightButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewToggleBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  viewToggleText: { fontSize: 18 },
  markAllButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#28a745', minWidth: 80, alignItems: 'center' },
  markAllButtonDisabled: { backgroundColor: '#888', opacity: 0.6 },
  markAllButtonText: { fontSize: fontSize.small, fontWeight: '600', color: 'white' },

  listContent: { paddingHorizontal: 12, paddingVertical: 8, flexGrow: 1 },

  // カード表示（従来の横並び）
  articleCard: { borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, flexDirection: 'row', padding: 12 },
  // リスト表示（境界線ありの横並び）
  articleListRow: { flexDirection: 'row', padding: 12, paddingHorizontal: 16, alignItems: 'center' },
  // マガジン表示（画像が上で縦並び）
  articleMagazine: { borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, flexDirection: 'column', padding: 12 },

  articleCardRead: { opacity: 0.6 },
  checkboxContainer: { justifyContent: 'center', marginRight: 10 },
  thumbnailCard: { width: 80, height: 80, backgroundColor: '#e0e0e0', borderRadius: 8 },
  thumbnailMagazine: { width: '100%', height: 160, backgroundColor: '#e0e0e0', borderRadius: 8, marginBottom: 12 },
  noThumbnailCard: { width: 80, height: 80, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  noThumbnailMagazine: { width: '100%', height: 160, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  noThumbnailText: { fontSize: fontSize.xSmall },
  articleContent: { flex: 1, marginLeft: 10, justifyContent: 'center' },
  articleMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  favicon: { width: 14, height: 14, borderRadius: 2, marginRight: 6 },
  feedTitleText: { fontSize: fontSize.small, fontWeight: '600' },
  readLaterBadge: { fontSize: 11, marginHorizontal: 3 },
  dot: { marginHorizontal: 4 },
  time: { fontSize: fontSize.small },
  articleTitle: { fontSize: fontSize.normal, fontWeight: '600', marginBottom: 4, lineHeight: 20 },
  articleDescription: { fontSize: fontSize.small, lineHeight: 18 },
  footer: { paddingVertical: 20, alignItems: 'center' },
  footerText: { fontSize: fontSize.small },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingTop: 100 },
  emptyTitle: { fontSize: fontSize.xLarge, fontWeight: '600', marginBottom: 8 },
  emptyText: { fontSize: fontSize.normal, textAlign: 'center', lineHeight: 22 },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: fontSize.normal },
})
