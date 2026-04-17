import React, { useContext, useEffect, useState, useCallback } from 'react'
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { colors, fontSize, getThemeColors } from '../../theme'
import { UserContext } from '../../contexts/UserContext'
import { useTheme } from '../../contexts/ThemeContext'
import ScreenTemplate from '../../components/ScreenTemplate'
import { showToast, showErrorToast } from '../../utils/showToast'
import { useAsyncStorageState } from '../../utils/useAsyncStorageState'

export default function ReadLater() {
  const navigation = useNavigation()
  const { getAccessToken } = useContext(UserContext)
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)

  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [favoritedIds, setFavoritedIds] = useState(new Set())
  const [readIds, setReadIds] = useState(new Set()) // 開いた記事（薄く表示）

  const [viewMode, setViewMode] = useAsyncStorageState('@readlater_viewMode', 'list')

  const callAPI = useCallback(async (method, body = null, query = '') => {
    const token = await getAccessToken()
    const res = await fetch(`/api/read-later${query}`, {
      method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    return res.json()
  }, [getAccessToken])

  // 初回取得
  const fetchArticles = useCallback(async () => {
    setLoading(true)
    try {
      const data = await callAPI('GET')
      if (data.success) setArticles(data.data.articles || [])
    } catch (e) {
      showErrorToast({ title: 'Error', body: 'Failed to load Read Later' })
    } finally {
      setLoading(false)
    }
  }, [callAPI])

  // Pull-to-refresh: 既読を除外して再取得
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    const currentReadIds = new Set(readIds) // 現在の既読を保存
    try {
      const data = await callAPI('GET')
      if (data.success) {
        // 既読のものを除外
        const fresh = (data.data.articles || []).filter(
          a => !currentReadIds.has(a.article_id)
        )
        setArticles(fresh)
        setReadIds(new Set()) // 既読セットをリセット
      }
    } catch (e) {
      showErrorToast({ title: 'Error', body: 'Failed to refresh' })
    } finally {
      setRefreshing(false)
    }
  }, [callAPI, readIds])

  const fetchFavorites = useCallback(async () => {
    try {
      const token = await getAccessToken()
      const res = await fetch('/api/favorites', { headers: { 'Authorization': `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) setFavoritedIds(new Set(data.data.favorites.map(f => f.articleId)))
    } catch (e) { console.error(e) }
  }, [getAccessToken])

  useEffect(() => {
    fetchArticles()
    fetchFavorites()
  }, [fetchArticles, fetchFavorites])

  const handleRemove = useCallback(async (articleId) => {
    try {
      await callAPI('DELETE', null, `?articleId=${encodeURIComponent(articleId)}`)
      setArticles(prev => prev.filter(a => a.article_id !== articleId))
      showToast({ title: '削除しました', body: '' })
    } catch (e) {
      showErrorToast({ title: 'Error', body: 'Failed to remove' })
    }
  }, [callAPI])

  const handleToggleFavorite = useCallback(async (article) => {
    const isFav = favoritedIds.has(article.article_id)
    try {
      const token = await getAccessToken()
      if (isFav) {
        await fetch(`/api/favorites/${article.article_id}`, {
          method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` },
        })
        setFavoritedIds(prev => { const s = new Set(prev); s.delete(article.article_id); return s })
        showToast({ title: 'Favorites削除', body: '' })
      } else {
        await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            articleId: article.article_id, title: article.title, url: article.url,
            description: article.description, feedTitle: article.feed_title, imageUrl: article.image_url,
          }),
        })
        setFavoritedIds(prev => new Set([...prev, article.article_id]))
        showToast({ title: '⭐ Favorites追加', body: '' })
      }
    } catch (e) { showErrorToast({ title: 'Error', body: 'Failed' }) }
  }, [favoritedIds, getAccessToken])

  // 記事を開く → 既読セットに追加（リストには残る・薄く表示）
  const handleArticlePress = useCallback((article) => {
    setReadIds(prev => new Set([...prev, article.article_id]))
    // APIで既読マーク
    getAccessToken().then(token => {
      fetch('/api/articles/read', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: article.article_id }),
      }).catch(console.error)
    })
    navigation.navigate('ArticleDetail', {
      article: {
        id: article.article_id, title: article.title, url: article.url,
        description: article.description, feedTitle: article.feed_title, imageUrl: article.image_url,
      }
    })
  }, [getAccessToken, navigation])

  const getRelativeTime = (d) => {
    if (!d) return ''
    const diff = Math.floor((Date.now() - new Date(d)) / 1000)
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  const readCount = readIds.size
  const isListMode = viewMode === 'list'

  const renderItem = ({ item }) => {
    const isFav = favoritedIds.has(item.article_id)
    const isRead = readIds.has(item.article_id)

    return (
      <TouchableOpacity
        style={[
          isListMode ? styles.listRow : styles.card,
          { backgroundColor: theme.card },
          isListMode && { borderBottomColor: theme.border, borderBottomWidth: 1 },
          isRead && styles.readItem, // 既読は薄く
        ]}
        onPress={() => handleArticlePress(item)}
        activeOpacity={0.7}
      >
        {!isListMode && item.image_url && (
          <Image source={{ uri: item.image_url }} style={styles.thumbnail} resizeMode="cover" />
        )}

        <View style={[styles.content, isListMode && { marginLeft: 0 }]}>
          <Text style={[styles.feedTitle, { color: colors.primary }]} numberOfLines={1}>
            {item.feed_title || 'Feed'} · {getRelativeTime(item.saved_at)}
            {isRead ? ' · ✓ Read' : ''}
          </Text>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={isListMode ? 1 : 2}>
            {item.title}
          </Text>
          {!isListMode && item.description && (
            <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>

        {/* 星ボタン */}
        <TouchableOpacity onPress={() => handleToggleFavorite(item)} style={styles.starBtn}>
          <Text style={{ fontSize: 20, color: isFav ? '#FFD700' : theme.textMuted }}>★</Text>
        </TouchableOpacity>

        {/* 削除ボタン */}
        <TouchableOpacity onPress={() => handleRemove(item.article_id)} style={styles.deleteBtn}>
          <Text style={[styles.deleteBtnText, { color: theme.textMuted }]}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    )
  }

  return (
    <ScreenTemplate>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>📌 Read Later</Text>
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={styles.badgeText}>{articles.length}</Text>
          </View>
          {readCount > 0 && (
            <Text style={[styles.readCountText, { color: theme.textMuted }]}>
              {readCount}件既読
            </Text>
          )}
        </View>
        {/* 表示切替 */}
        <TouchableOpacity
          style={[styles.viewToggleBtn, { borderColor: theme.border }]}
          onPress={() => setViewMode(v => v === 'card' ? 'list' : 'card')}
        >
          <Text style={[styles.viewToggleText, { color: theme.text }]}>
            {viewMode === 'card' ? '☰' : '⊞'}
          </Text>
        </TouchableOpacity>
      </View>

      {readCount > 0 && (
        <View style={[styles.refreshHint, { backgroundColor: isDarkMode ? '#2d2d2d' : '#f0f9f0' }]}>
          <Text style={[styles.refreshHintText, { color: theme.textMuted }]}>
            ↓ Pull to refresh で既読記事を消去
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : articles.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            📌 Read Laterに保存した記事はありません{'\n'}
            記事を左スワイプして追加しましょう
          </Text>
        </View>
      ) : (
        <FlatList
          data={articles}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, isListMode && { padding: 0 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: fontSize.xLarge, fontWeight: '700', color: colors.primary },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  badgeText: { color: 'white', fontSize: fontSize.small, fontWeight: '700' },
  readCountText: { fontSize: fontSize.small },
  viewToggleBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  viewToggleText: { fontSize: 18 },
  refreshHint: { paddingVertical: 6, paddingHorizontal: 16, alignItems: 'center' },
  refreshHintText: { fontSize: fontSize.small },

  list: { padding: 12, flexGrow: 1 },
  card: { borderRadius: 12, marginVertical: 6, padding: 12, flexDirection: 'row', alignItems: 'flex-start', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  readItem: { opacity: 0.5 }, // 既読は薄く
  thumbnail: { width: 70, height: 70, borderRadius: 8, marginRight: 10 },
  content: { flex: 1, marginLeft: 4 },
  feedTitle: { fontSize: fontSize.small, fontWeight: '600', marginBottom: 4 },
  title: { fontSize: fontSize.normal, fontWeight: '600', lineHeight: 20, marginBottom: 4 },
  description: { fontSize: fontSize.small, lineHeight: 18 },
  starBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  deleteBtn: { padding: 6, marginLeft: 4 },
  deleteBtnText: { fontSize: 16 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: fontSize.normal, textAlign: 'center', lineHeight: 24 },
})
