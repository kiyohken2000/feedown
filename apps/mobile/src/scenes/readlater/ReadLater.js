import React, { useContext, useEffect, useState, useCallback } from 'react'
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  Image, ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { colors, fontSize, getThemeColors } from '../../theme'
import { UserContext } from '../../contexts/UserContext'
import { FeedsContext } from '../../contexts/FeedsContext'
import { useTheme } from '../../contexts/ThemeContext'
import ScreenTemplate from '../../components/ScreenTemplate'
import { showToast, showErrorToast } from '../../utils/showToast'
import { useAsyncStorageState } from '../../utils/useAsyncStorageState'

export default function ReadLater() {
  const navigation = useNavigation()
  const { getAccessToken } = useContext(UserContext)
  const { api } = useContext(FeedsContext)
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)

  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [favoritedIds, setFavoritedIds] = useState(new Set())

  // 永続化された設定
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

  // Favorites一覧取得
  const fetchFavorites = useCallback(async () => {
    try {
      const token = await getAccessToken()
      const res = await fetch('/api/favorites', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
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
      setSelectedIds(prev => { const s = new Set(prev); s.delete(articleId); return s })
      showToast({ title: '削除しました', body: '' })
    } catch (e) {
      showErrorToast({ title: 'Error', body: 'Failed to remove' })
    }
  }, [callAPI])

  const handleRemoveSelected = useCallback(async () => {
    for (const id of [...selectedIds]) await handleRemove(id)
    setSelectionMode(false)
    setSelectedIds(new Set())
  }, [selectedIds, handleRemove])

  const handleToggleFavorite = useCallback(async (e, article) => {
    const isFav = favoritedIds.has(article.article_id)
    try {
      const token = await getAccessToken()
      if (isFav) {
        await fetch(`/api/favorites/${article.article_id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        })
        setFavoritedIds(prev => { const s = new Set(prev); s.delete(article.article_id); return s })
        showToast({ title: 'Favorites削除', body: '' })
      } else {
        await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            articleId: article.article_id,
            title: article.title,
            url: article.url,
            description: article.description,
            feedTitle: article.feed_title,
            imageUrl: article.image_url,
          }),
        })
        setFavoritedIds(prev => new Set([...prev, article.article_id]))
        showToast({ title: '⭐ Favorites追加', body: '' })
      }
    } catch (e) {
      showErrorToast({ title: 'Error', body: 'Failed' })
    }
  }, [favoritedIds, getAccessToken])

  const handleToggleCheck = useCallback((articleId) => {
    setSelectedIds(prev => {
      const s = new Set(prev)
      s.has(articleId) ? s.delete(articleId) : s.add(articleId)
      return s
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === articles.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(articles.map(a => a.article_id)))
  }, [selectedIds, articles])

  const allSelected = articles.length > 0 && selectedIds.size === articles.length

  const getRelativeTime = (d) => {
    if (!d) return ''
    const diff = Math.floor((Date.now() - new Date(d)) / 1000)
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  const renderItem = ({ item, index }) => {
    const isChecked = selectedIds.has(item.article_id)
    const isFav = favoritedIds.has(item.article_id)
    const isListMode = viewMode === 'list'

    return (
      <TouchableOpacity
        style={[
          isListMode ? styles.listRow : styles.card,
          { backgroundColor: theme.card },
          isChecked && styles.cardChecked,
          isListMode && { borderBottomColor: theme.border, borderBottomWidth: 1 },
        ]}
        onPress={() => selectionMode
          ? handleToggleCheck(item.article_id)
          : navigation.navigate('ArticleDetail', {
              article: {
                id: item.article_id, title: item.title, url: item.url,
                description: item.description, feedTitle: item.feed_title, imageUrl: item.image_url,
              }
            })
        }
        onLongPress={() => { setSelectionMode(true); setSelectedIds(new Set([item.article_id])) }}
      >
        {selectionMode && (
          <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
            {isChecked && <Text style={styles.checkmark}>✓</Text>}
          </View>
        )}

        {/* 星ボタン（常に表示） */}
        <TouchableOpacity
          onPress={() => handleToggleFavorite(null, item)}
          style={styles.starBtn}
        >
          <Text style={{ fontSize: 18, color: isFav ? '#FFD700' : theme.textMuted }}>★</Text>
        </TouchableOpacity>

        {!isListMode && item.image_url && (
          <Image source={{ uri: item.image_url }} style={styles.thumbnail} resizeMode="cover" />
        )}

        <View style={[styles.content, isListMode && { marginLeft: 0 }]}>
          <Text style={[styles.feedTitle, { color: colors.primary }]} numberOfLines={1}>
            {item.feed_title || 'Feed'} · {getRelativeTime(item.saved_at)}
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

        {!selectionMode && (
          <TouchableOpacity onPress={() => handleRemove(item.article_id)} style={styles.deleteBtn}>
            <Text style={[styles.deleteBtnText, { color: theme.textMuted }]}>✕</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <ScreenTemplate>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={styles.headerTitle}>📌 Read Later</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* 表示切替 */}
          <TouchableOpacity
            style={[styles.viewToggleBtn, { borderColor: theme.border }]}
            onPress={() => setViewMode(v => v === 'card' ? 'list' : 'card')}
          >
            <Text style={[styles.viewToggleText, { color: theme.text }]}>
              {viewMode === 'card' ? '☰' : '⊞'}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.count, { color: theme.textMuted }]}>{articles.length}件</Text>
        </View>
      </View>

      {/* 選択モードバー */}
      {selectionMode && (
        <View style={[styles.selectionBar, { backgroundColor: isDarkMode ? '#2d2d2d' : '#fff3e0', borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={handleSelectAll} style={styles.selectAllBtn}>
            <View style={[styles.checkbox, allSelected && styles.checkboxChecked]}>
              {allSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.selectAllText, { color: theme.text }]}>
              {selectedIds.size > 0 ? `${selectedIds.size}件選択` : '全選択'}
            </Text>
          </TouchableOpacity>
          <View style={styles.selectionActions}>
            <TouchableOpacity
              onPress={handleRemoveSelected}
              disabled={selectedIds.size === 0}
              style={[styles.deleteSelectedBtn, selectedIds.size === 0 && { opacity: 0.5 }]}
            >
              <Text style={styles.deleteSelectedText}>削除 ({selectedIds.size})</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setSelectionMode(false); setSelectedIds(new Set()) }} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: theme.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View>
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
          contentContainerStyle={[styles.list, viewMode === 'list' && { padding: 0 }]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: fontSize.xLarge, fontWeight: '700', color: colors.primary },
  count: { fontSize: fontSize.normal },
  viewToggleBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  viewToggleText: { fontSize: 18 },

  selectionBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectAllText: { fontSize: fontSize.small, fontWeight: '600' },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: 'white', fontSize: 13, fontWeight: '700' },
  selectionActions: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
  deleteSelectedBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#dc3545' },
  deleteSelectedText: { color: 'white', fontSize: fontSize.small, fontWeight: '700' },
  cancelBtn: { padding: 6 },
  cancelText: { fontSize: 18, fontWeight: '700' },

  list: { padding: 12, flexGrow: 1 },
  card: { borderRadius: 12, marginVertical: 6, padding: 12, flexDirection: 'row', alignItems: 'flex-start', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  cardChecked: { borderWidth: 2, borderColor: colors.primary },
  starBtn: { paddingHorizontal: 6, paddingVertical: 2, justifyContent: 'center' },
  thumbnail: { width: 70, height: 70, borderRadius: 8, marginRight: 10 },
  content: { flex: 1, marginLeft: 4 },
  feedTitle: { fontSize: fontSize.small, fontWeight: '600', marginBottom: 4 },
  title: { fontSize: fontSize.normal, fontWeight: '600', lineHeight: 20, marginBottom: 4 },
  description: { fontSize: fontSize.small, lineHeight: 18 },
  deleteBtn: { padding: 6, marginLeft: 8 },
  deleteBtnText: { fontSize: 16 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: fontSize.normal, textAlign: 'center', lineHeight: 24 },
})
