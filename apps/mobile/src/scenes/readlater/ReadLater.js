import React, { useContext, useEffect, useState, useCallback, useMemo } from 'react'
import {
  StyleSheet, Text, View, SectionList, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { colors, fontSize, getThemeColors } from '../../theme'
import { UserContext } from '../../contexts/UserContext'
import { useTheme } from '../../contexts/ThemeContext'
import { FeedsContext } from '../../contexts/FeedsContext' // ★カテゴリ情報取得用に追加
import ScreenTemplate from '../../components/ScreenTemplate'
import { showToast, showErrorToast } from '../../utils/showToast'
import { useAsyncStorageState } from '../../utils/useAsyncStorageState'

const stripHtml = (html) => html?.replace(/<[^>]*>/g, '') || '';

export default function ReadLater() {
  const navigation = useNavigation()
  const { getAccessToken, serverUrl } = useContext(UserContext)
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)
  const { feeds } = useContext(FeedsContext) // ★追加

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
        await fetch(`${serverUrl}/api/favorites`, {
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

  // ★ Home.js と同じカテゴリグループ化ロジック
  const groupedArticles = useMemo(() => {
    if (!articles.length) return []
    const catMap = {}
    const uncategorized = []
    articles.forEach(article => {
      const feed = feeds.find(f => f.title === article.feed_title)
      const cat = feed?.category || null
      if (cat) {
        if (!catMap[cat]) catMap[cat] = []
        catMap[cat].push(article)
      } else {
        uncategorized.push(article)
      }
    })
    const sorted = Object.entries(catMap).sort(([a], [b]) => a.localeCompare(b, 'ja'))
    if (uncategorized.length > 0) sorted.push(['その他', uncategorized])
    return sorted.map(([title, data]) => ({ title, data }))
  }, [articles, feeds])

  const readCount = readIds.size
  const isListMode = viewMode === 'list'
  const isMagazineMode = viewMode === 'magazine'
  const isCardMode = viewMode === 'card'

  const renderItem = ({ item }) => {
    const isFav = favoritedIds.has(item.article_id)
    const isRead = readIds.has(item.article_id)
    const feed = feeds.find(f => f.title === item.feed_title)

    return (
      <View style={{ marginVertical: isListMode ? 0 : 6, marginHorizontal: isListMode ? 0 : 12 }}>
        <TouchableOpacity
          style={[
            isCardMode ? styles.articleCard : isMagazineMode ? styles.articleMagazine : styles.articleListRow,
            { backgroundColor: isListMode ? 'transparent' : theme.card },
            isRead && styles.readItem,
            isListMode && { borderBottomColor: theme.border, borderBottomWidth: 1 },
          ]}
          onPress={() => handleArticlePress(item)}
          activeOpacity={0.7}
        >
          {item.image_url ? (
            <Image 
              source={{ uri: item.image_url }} 
              style={isCardMode ? styles.thumbnailCard : isMagazineMode ? styles.thumbnailMagazine : styles.thumbnailList} 
              resizeMode="cover" 
            />
          ) : (
            <View style={[isCardMode ? styles.noThumbnailCard : isMagazineMode ? styles.noThumbnailMagazine : styles.noThumbnailList, { backgroundColor: theme.border }]}>
              <Text style={[styles.noThumbnailText, { color: theme.textMuted }]}>📡</Text>
            </View>
          )}

          <View style={[styles.articleContent, isCardMode && { padding: 12, marginLeft: 0 }]}>
            <View style={styles.articleMeta}>
              {feed?.faviconUrl && (
                <Image source={{ uri: feed.faviconUrl }} style={styles.favicon} />
              )}
              <Text style={[styles.feedTitleText, { color: theme.textSecondary, flex: 1 }]} numberOfLines={1}>
                {item.feed_title || 'Unknown Feed'}
              </Text>
              {isListMode && isRead && <Text style={{ color: '#28a745', fontSize: 12, marginHorizontal: 4 }}>✓</Text>}
              <Text style={[styles.dot, { color: theme.textMuted }]}>·</Text>
              <Text style={[styles.time, { color: theme.textMuted }]}>{getRelativeTime(item.saved_at)}</Text>
            </View>
            
            <Text
              style={[styles.articleTitle, { color: theme.text }, isListMode && { fontSize: fontSize.normal }, (isMagazineMode || isCardMode) && { fontSize: fontSize.large, marginBottom: 4 }]}
              numberOfLines={isListMode ? 1 : 3}
            >
              {stripHtml(item.title)}
            </Text>
            {!isListMode && (
              <Text style={[styles.articleDescription, { color: theme.textSecondary }]} numberOfLines={isMagazineMode ? 3 : 2}>
                {stripHtml(item.description) || ''}
              </Text>
            )}

            {/* ReadLater 用のアクションボタン（Card / Magazine は下部に配置） */}
            {!isListMode && (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 16 }}>
                <TouchableOpacity onPress={() => handleToggleFavorite(item)}>
                  <Text style={{ fontSize: 20, color: isFav ? '#FFD700' : theme.textMuted }}>★</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleRemove(item.article_id)}>
                  <Text style={{ fontSize: 18, color: theme.textMuted }}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* List用のアクションボタン（右側にインライン配置） */}
          {isListMode && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 8 }}>
              <TouchableOpacity onPress={() => handleToggleFavorite(item)}>
                <Text style={{ fontSize: 18, color: isFav ? '#FFD700' : theme.textMuted }}>★</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleRemove(item.article_id)}>
                <Text style={{ fontSize: 16, color: theme.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

        </TouchableOpacity>
      </View>
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
        <SectionList
          key={viewMode}
          sections={groupedArticles}
          renderItem={renderItem}
          keyExtractor={item => item.article_id}
          extraData={{ viewMode, favoritedIds: favoritedIds.size, readIds: readIds.size }}
          // ★ Home.js と完全一致するカテゴリヘッダー（オレンジ帯）
          renderSectionHeader={({ section: { title, data } }) => (
            <View style={[styles.sectionHeader, { borderBottomColor: isDarkMode ? '#444' : '#e0e0e0' }]}>
              <Text style={[styles.sectionHeaderText, { color: theme.textSecondary }]}>{title}</Text>
              <Text style={{ fontSize: 12, color: theme.textSecondary }}>{data.length}件</Text>
            </View>
          )}
          contentContainerStyle={[
            styles.listContent,
            (viewMode === 'list' || viewMode === 'magazine') && { paddingHorizontal: 0, paddingVertical: 0 }
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
          }
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
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

  // ★ Home.js 準拠のカテゴリ見出しスタイル
  sectionHeader: { 
    flexDirection: 'row', alignItems: 'center', paddingBottom: 6, marginBottom: 12, marginTop: 20,
    marginHorizontal: 12, borderBottomWidth: 2, borderLeftWidth: 4, borderLeftColor: '#FF6B35', paddingLeft: 8
  },
  sectionHeaderText: { fontSize: 16, fontWeight: '700', marginRight: 8 },

  listContent: { paddingHorizontal: 12, paddingVertical: 8, flexGrow: 1 },

  // ★ Home.js 準拠のビューレイアウト
  articleCard: { borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, flexDirection: 'column' },
  articleListRow: { flexDirection: 'row', padding: 12, paddingHorizontal: 16, alignItems: 'center' },
  articleMagazine: { borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, flexDirection: 'row', padding: 12, alignItems: 'flex-start' },

  readItem: { opacity: 0.5 },

  thumbnailCard: { width: '100%', height: 150, backgroundColor: '#e0e0e0' },
  thumbnailList: { width: 56, height: 42, borderRadius: 5, marginRight: 10, backgroundColor: '#e0e0e0' },
  thumbnailMagazine: { width: 160, height: 110, borderRadius: 8, marginRight: 12, backgroundColor: '#e0e0e0' },
  
  noThumbnailCard: { width: '100%', height: 60, justifyContent: 'center', alignItems: 'center' },
  noThumbnailList: { width: 56, height: 42, borderRadius: 5, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  noThumbnailMagazine: { width: 160, height: 110, borderRadius: 8, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  noThumbnailText: { fontSize: 24, opacity: 0.5 },
  
  articleContent: { flex: 1, justifyContent: 'center' },
  articleMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  favicon: { width: 14, height: 14, borderRadius: 2, marginRight: 6 },
  feedTitleText: { fontSize: fontSize.small, fontWeight: '600' },
  dot: { marginHorizontal: 4 },
  time: { fontSize: fontSize.small },
  articleTitle: { fontSize: fontSize.normal, fontWeight: '600', marginBottom: 4, lineHeight: 20 },
  articleDescription: { fontSize: fontSize.small, lineHeight: 18 },

  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: fontSize.normal, textAlign: 'center', lineHeight: 24 },
})