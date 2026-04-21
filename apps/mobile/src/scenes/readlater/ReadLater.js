import React, { useContext, useEffect, useState, useCallback } from 'react'
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { colors, fontSize, getThemeColors } from '../../theme'
import { UserContext } from '../../contexts/UserContext'
import { useTheme } from '../../contexts/ThemeContext'
import ScreenTemplate from '../../components/ScreenTemplate'
import { showToast, showErrorToast } from '../../utils/showToast'
import { useAsyncStorageState } from '../../utils/useAsyncStorageState'

export default function ReadLater() {
  const navigation = useNavigation()
  const { getAccessToken, serverUrl } = useContext(UserContext)
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)

  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [favoritedIds, setFavoritedIds] = useState(new Set())
  const [readIds, setReadIds] = useState(new Set())
  const [viewMode, setViewMode] = useAsyncStorageState('@readlater_viewMode', 'list')

  const callAPI = useCallback(async (method, body = null, query = '') => {
    const token = await getAccessToken()
    const res = await fetch(`${serverUrl}/api/read-later${query}`, {
      method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    return res.json()
  }, [getAccessToken, serverUrl])

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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    const currentReadIds = new Set(readIds)
    try {
      const data = await callAPI('GET')
      if (data.success) {
        setArticles((data.data.articles || []).filter(a => !currentReadIds.has(a.article_id)))
        setReadIds(new Set())
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
      const res = await fetch(`${serverUrl}/api/favorites`, { headers: { 'Authorization': `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) setFavoritedIds(new Set(data.data.favorites.map(f => f.articleId)))
    } catch (e) { console.error(e) }
  }, [getAccessToken, serverUrl])

  useEffect(() => {
    fetchArticles()
    fetchFavorites()
  }, [fetchArticles, fetchFavorites])

  useFocusEffect(
    useCallback(() => {
      fetchArticles()
    }, [fetchArticles])
  )

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
        await fetch(`${serverUrl}/api/favorites/${article.article_id}`, {
          method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` },
        })
        setFavoritedIds(prev => { const s = new Set(prev); s.delete(article.article_id); return s })
        showToast({ title: 'Favorites削除', body: '' })
      } else {
        const response = await fetch(`${serverUrl}/api/favorites`, {
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
    } catch (e) { 
      console.log('Favorite error:', JSON.stringify(e))
      showErrorToast({ title: 'Error', body: e.message || 'Failed' }) 
    }
  }, [favoritedIds, getAccessToken, serverUrl])

  const handleArticlePress = useCallback((article) => {
    setReadIds(prev => new Set([...prev, article.article_id]))
    getAccessToken().then(token => {
      fetch(`${serverUrl}/api/articles/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: article.article_id }),
      }).catch(console.error)
    })
    callAPI('DELETE', null, `?articleId=${encodeURIComponent(article.article_id)}`).catch(console.error)
    navigation.navigate('ArticleDetail', {
      article: {
        id: article.article_id, title: article.title, url: article.url,
        description: article.description, feedTitle: article.feed_title, imageUrl: article.image_url,
      }
    })
  }, [getAccessToken, navigation, callAPI, serverUrl])

  const getRelativeTime = (d) => {
    if (!d) return ''
    const diff = Math.floor((Date.now() - new Date(d)) / 1000)
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  const readCount = readIds.size
  const isListMode = viewMode === 'list'
  const isMagazineMode = viewMode === 'magazine'
  const isCardMode = viewMode === 'card'

  const renderItem = ({ item }) => {
    const isFav = favoritedIds.has(item.article_id)
    const isRead = readIds.has(item.article_id)

    // LIST表示
    if (isListMode) {
      return (
        <TouchableOpacity
          style={[styles.listRow, { backgroundColor: theme.card, borderBottomColor: theme.border }, isRead && styles.readItem]}
          onPress={() => handleArticlePress(item)}
          activeOpacity={0.7}
        >
          {item.image_url
            ? <Image source={{ uri: item.image_url }} style={styles.listThumbnail} resizeMode="cover" />
            : <View style={[styles.listThumbnail, { backgroundColor: theme.border, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: theme.textMuted, fontSize: 10 }}>No img</Text>
              </View>
          }
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.feedTitle, { color: theme.textSecondary }]} numberOfLines={1}>{item.feed_title || 'Feed'}</Text>
            <Text style={[styles.title, { color: theme.text, fontSize: fontSize.normal }]} numberOfLines={1}>{item.title}</Text>
          </View>
          <Text style={[styles.time, { color: theme.textMuted, marginLeft: 8 }]}>{getRelativeTime(item.saved_at)}</Text>
          <TouchableOpacity onPress={() => handleToggleFavorite(item)} style={styles.starBtn}>
            <Text style={{ fontSize: 18, color: isFav ? '#FFD700' : theme.textMuted }}>★</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleRemove(item.article_id)} style={styles.deleteBtn}>
            <Text style={{ fontSize: 16, color: theme.textMuted }}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      )
    }

    // CARD/MAGAZINEのreturnの前に追加
    if (isMagazineMode) {
      return (
        <TouchableOpacity
          style={[styles.magazineCard, { backgroundColor: theme.card, borderBottomColor: theme.border }, isRead && styles.readItem]}
          onPress={() => handleArticlePress(item)}
          activeOpacity={0.7}
        >
          {item.image_url
            ? <Image source={{ uri: item.image_url }} style={styles.magazineThumbnail} resizeMode="cover" />
            : <View style={[styles.magazineThumbnail, { backgroundColor: theme.border, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: theme.textMuted }}>No image</Text>
              </View>
          }
          <View style={styles.magazineContent}>
            <Text style={[styles.feedTitle, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.feed_title || 'Feed'} · {getRelativeTime(item.saved_at)}
            </Text>
            <Text style={[styles.magazineTitle, { color: theme.text }]} numberOfLines={2}>{item.title}</Text>
            {item.description && (
              <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={3}>{item.description}</Text>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
              <TouchableOpacity onPress={() => handleToggleFavorite(item)} style={styles.starBtn}>
                <Text style={{ fontSize: 18, color: isFav ? '#FFD700' : theme.textMuted }}>★</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleRemove(item.article_id)} style={styles.deleteBtn}>
                <Text style={{ fontSize: 16, color: theme.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      )
    }

    // CARD / MAGAZINE表示（縦型・画像上部）
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.card }, isRead && styles.readItem]}
        onPress={() => handleArticlePress(item)}
        activeOpacity={0.7}
      >
        {/* 画像（フル幅） */}
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={isMagazineMode ? styles.imageMagazine : styles.imageCard}
            resizeMode="cover"
          />
        ) : (
          <View style={[isMagazineMode ? styles.imageMagazine : styles.imageCard, { backgroundColor: theme.border, justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ color: theme.textMuted, fontSize: fontSize.small }}>No image</Text>
          </View>
        )}
        {/* コンテンツ */}
        <View style={styles.cardContent}>
          <Text style={[styles.feedTitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.feed_title || 'Feed'} · {getRelativeTime(item.saved_at)}{isRead ? ' · ✓ Read' : ''}
          </Text>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={isMagazineMode ? 3 : 2}>
            {item.title}
          </Text>
          {item.description && (
            <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={isMagazineMode ? 3 : 2}>
              {item.description}
            </Text>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 8 }}>
            <TouchableOpacity onPress={() => handleToggleFavorite(item)} style={styles.starBtn}>
              <Text style={{ fontSize: 20, color: isFav ? '#FFD700' : theme.textMuted }}>★</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleRemove(item.article_id)} style={styles.deleteBtn}>
              <Text style={{ fontSize: 16, color: theme.textMuted }}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <ScreenTemplate>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>📌 Read Later</Text>
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={styles.badgeText}>{articles.length}</Text>
          </View>
          {readCount > 0 && (
            <Text style={[styles.readCountText, { color: theme.textMuted }]}>{readCount}件既読</Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.viewToggleBtn, { borderColor: theme.border }]}
          onPress={() => setViewMode(v => v === 'card' ? 'list' : v === 'list' ? 'magazine' : 'card')}
        >
          <Text style={[styles.viewToggleText, { color: theme.text }]}>
            {viewMode === 'card' ? '☰' : viewMode === 'list' ? '📰' : '⊞'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : articles.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            📌 Read Laterに保存した記事はありません{'\n'}記事を左スワイプして追加しましょう
          </Text>
        </View>
      ) : (
        <FlatList
          key={viewMode}
          data={articles}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          extraData={{ viewMode, favoritedIds: favoritedIds.size, readIds: readIds.size }}
          contentContainerStyle={[
            isListMode ? styles.listContent : styles.cardContent_list,
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
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
  headerTitle: { fontSize: fontSize.xxLarge, fontWeight: 'bold' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  badgeText: { color: 'white', fontSize: fontSize.small, fontWeight: '700' },
  readCountText: { fontSize: fontSize.small },
  viewToggleBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  viewToggleText: { fontSize: 18 },
  refreshHint: { paddingVertical: 6, paddingHorizontal: 16, alignItems: 'center' },
  refreshHintText: { fontSize: fontSize.small },


  listThumbnail: { width: 56, height: 42, borderRadius: 6 },
  magazineCard: { flexDirection: 'row', padding: 14, paddingHorizontal: 16, borderBottomWidth: 1, alignItems: 'flex-start', gap: 12 },
  magazineThumbnail: { width: 120, height: 90, borderRadius: 8 },
  magazineContent: { flex: 1 },
  magazineTitle: { fontSize: fontSize.large, fontWeight: '700', lineHeight: 22, marginBottom: 4 },

  // リスト
  listContent: { flexGrow: 1 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1 },

  // カード・マガジン共通
  cardContent_list: { padding: 12, flexGrow: 1 },
  card: { borderRadius: 12, marginVertical: 6, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  imageCard: { width: '100%', height: 160 },
  imageMagazine: { width: '100%', height: 200 },
  cardContent: { padding: 12 },

  readItem: { opacity: 0.5 },
  feedTitle: { fontSize: fontSize.small, fontWeight: '600', marginBottom: 4 },
  title: { fontSize: fontSize.large, fontWeight: '600', lineHeight: 22, marginBottom: 4 },
  description: { fontSize: fontSize.small, lineHeight: 18 },
  starBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  deleteBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: fontSize.normal, textAlign: 'center', lineHeight: 24 },
})