import React, { useContext, useEffect, useCallback, useState, useMemo } from 'react'
import {
  StyleSheet, Text, View, SectionList, TouchableOpacity,
  Image, RefreshControl, ActivityIndicator, Vibration,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import { colors, fontSize, getThemeColors } from '../../theme'
import { FeedsContext } from '../../contexts/FeedsContext'
import { useTheme } from '../../contexts/ThemeContext'
import ScreenTemplate from '../../components/ScreenTemplate'
import { showToast, showErrorToast } from '../../utils/showToast'
import { useAsyncStorageState } from '../../utils/useAsyncStorageState'

const stripHtml = (html) => html?.replace(/<[^>]*>/g, '') || '';

export default function Favorites() {
  const navigation = useNavigation()
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)
  const { favorites, fetchFavorites, toggleFavorite, isLoading, feeds } = useContext(FeedsContext)

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const [viewMode, setViewMode] = useAsyncStorageState('@favorites_viewMode', 'card')
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [isDeletingSelected, setIsDeletingSelected] = useState(false)

  useEffect(() => { fetchFavorites() }, [])

  useFocusEffect(
    useCallback(() => {
      fetchFavorites()
    }, [fetchFavorites])
  )

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try { await fetchFavorites() } finally { setIsRefreshing(false) }
  }, [fetchFavorites])

  const handleLongPress = useCallback((favorite) => {
    Vibration.vibrate(50)
    setSelectionMode(true)
    setSelectedIds(new Set([favorite.articleId]))
  }, [])

  const handleToggleCheck = useCallback((articleId) => {
    setSelectedIds(prev => {
      const s = new Set(prev)
      s.has(articleId) ? s.delete(articleId) : s.add(articleId)
      return s
    })
  }, [])

  const handleExitSelection = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }, [])

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedIds.size) return
    setIsDeletingSelected(true)
    try {
      for (const id of selectedIds) {
        await toggleFavorite({ id })
      }
      showToast({ title: 'Removed', body: `${selectedIds.size}件を削除しました` })
      setSelectionMode(false)
      setSelectedIds(new Set())
    } catch (e) {
      showErrorToast({ title: 'Error', body: 'Failed to remove favorites' })
    } finally {
      setIsDeletingSelected(false)
    }
  }, [selectedIds, toggleFavorite])

  const handleArticlePress = useCallback((favorite) => {
    if (selectionMode) {
      handleToggleCheck(favorite.articleId)
      return
    }
    navigation.navigate('FavoriteDetail', {
      article: {
        id: favorite.articleId, title: favorite.title, url: favorite.url,
        description: favorite.description, feedTitle: favorite.feedTitle,
        imageUrl: favorite.imageUrl, publishedAt: favorite.createdAt,
      }
    })
  }, [navigation, selectionMode, handleToggleCheck])

  const getRelativeTime = (dateString) => {
    if (!dateString) return ''
    const diff = Math.floor((Date.now() - new Date(dateString)) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`
    return new Date(dateString).toLocaleDateString()
  }

  // カテゴリごとのグループ化ロジック (Home.jsに準拠)
  const groupedFavorites = useMemo(() => {
    if (!favorites.length) return []
    const catMap = {}
    const uncategorized = []
    favorites.forEach(favorite => {
      const feed = feeds.find(f => f.title === favorite.feedTitle)
      const cat = feed?.category || null
      if (cat) {
        if (!catMap[cat]) catMap[cat] = []
        catMap[cat].push(favorite)
      } else {
        uncategorized.push(favorite)
      }
    })
    const sorted = Object.entries(catMap).sort(([a], [b]) => a.localeCompare(b, 'ja'))
    if (uncategorized.length > 0) sorted.push(['その他', uncategorized])
    return sorted.map(([title, data]) => ({ title, data }))
  }, [favorites, feeds])

  const checkColor = isDarkMode ? '#555' : '#888'

  const renderFavorite = ({ item: favorite }) => {
    const isRemoving = removingId === favorite.articleId
    const isChecked = selectedIds.has(favorite.articleId)
    const isListMode = viewMode === 'list'
    const isMagazineMode = viewMode === 'magazine'
    const isCardMode = viewMode === 'card'
    const feed = feeds.find(f => f.title === favorite.feedTitle)

    return (
      <View style={{ marginVertical: (isListMode || isMagazineMode) ? 2 : 6, marginHorizontal: (isListMode || isMagazineMode) ? 0 : 12 }}>
        <TouchableOpacity
          style={[
            isListMode ? styles.articleListRow : isMagazineMode ? styles.articleMagazine : styles.articleCard,
            { backgroundColor: isChecked ? (isDarkMode ? '#3a3a2a' : '#fff8f0') : theme.card },
            isChecked && { borderColor: checkColor, borderWidth: 2 },
            isListMode && { borderBottomColor: theme.border, borderBottomWidth: 1 },
          ]}
          onPress={() => handleArticlePress(favorite)}
          onLongPress={() => handleLongPress(favorite)}
          activeOpacity={0.7} disabled={isRemoving}
        >
          {selectionMode && (
            <TouchableOpacity onPress={() => handleToggleCheck(favorite.articleId)} style={[styles.checkboxContainer, isMagazineMode && { position: 'absolute', top: 12, left: 12, zIndex: 10 }]}>
              <View style={[styles.checkbox, { borderColor: checkColor }, isChecked && { backgroundColor: checkColor }]}>
                {isChecked && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </TouchableOpacity>
          )}

          {!isListMode && (
            favorite.imageUrl ? (
              <Image source={{ uri: favorite.imageUrl }} style={isMagazineMode ? styles.thumbnailMagazine : styles.thumbnailCard} resizeMode="cover" />
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
              <Text style={[styles.feedTitleText, { color: theme.textSecondary, flex: 1 }]} numberOfLines={1}>
                {favorite.feedTitle || 'Unknown Feed'}
              </Text>
              <Text style={[styles.dot, { color: theme.textMuted }]}>·</Text>
              <Text style={[styles.time, { color: theme.textMuted }]}>{getRelativeTime(favorite.createdAt)}</Text>
            </View>
            <Text
              style={[styles.articleTitle, { color: theme.text }, isListMode && { fontSize: fontSize.normal }, isMagazineMode && { fontSize: fontSize.large, marginBottom: 6 }]}
              numberOfLines={isListMode ? 1 : 3}
            >
              {stripHtml(favorite.title)}
            </Text>
            {!isListMode && (
              <Text style={[styles.articleDescription, { color: theme.textSecondary }]} numberOfLines={isMagazineMode ? 3 : 2}>
                {stripHtml(favorite.description) || ''}
              </Text>
            )}
          </View>
          {isRemoving && <View style={styles.removingOverlay}><ActivityIndicator size="small" color={colors.primary} /></View>}
        </TouchableOpacity>
      </View>
    )
  }

  const renderEmpty = () => {
    if (isLoading || isRefreshing) return null
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>★</Text>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>No favorites yet</Text>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Articles you favorite will appear here.</Text>
      </View>
    )
  }

  const allSelected = favorites.length > 0 && selectedIds.size === favorites.length
  const viewToggleLabel = viewMode === 'card' ? '☰' : viewMode === 'list' ? '📰' : '⊞'

  return (
    <ScreenTemplate>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        {selectionMode ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity onPress={() => {
              if (allSelected) setSelectedIds(new Set())
              else setSelectedIds(new Set(favorites.map(f => f.articleId)))
            }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.checkbox, { borderColor: checkColor }, allSelected && { backgroundColor: checkColor }]}>
                {allSelected && <Text style={styles.checkmark}>✓</Text>}
                {!allSelected && selectedIds.size > 0 && <Text style={[styles.checkmark, { color: checkColor }]}>−</Text>}
              </View>
              <Text style={[{ color: theme.text, fontSize: fontSize.small, fontWeight: '600' }]}>
                {selectedIds.size > 0 ? `${selectedIds.size}件選択` : '全選択'}
              </Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={handleDeleteSelected}
              disabled={selectedIds.size === 0 || isDeletingSelected}
              style={[styles.deleteBtn, selectedIds.size === 0 && { opacity: 0.4 }]}
            >
              {isDeletingSelected
                ? <ActivityIndicator size="small" color="white" />
                : <Text style={styles.deleteBtnText}>🗑 削除 ({selectedIds.size})</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={handleExitSelection} style={{ padding: 6 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: theme.textMuted }}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Favorites</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                style={[styles.viewToggleBtn, { borderColor: theme.border }]}
                onPress={() => setViewMode(v => v === 'card' ? 'list' : v === 'list' ? 'magazine' : 'card')}
              >
                <Text style={[styles.viewToggleText, { color: theme.text }]}>{viewToggleLabel}</Text>
              </TouchableOpacity>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{favorites.length} saved</Text>
              </View>
            </View>
          </>
        )}
      </View>

      <SectionList
        key={viewMode}
        sections={groupedFavorites}
        extraData={{ viewMode, selectionMode, selectedIds: selectedIds.size }}
        renderItem={renderFavorite}
        keyExtractor={(item) => item.articleId}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        contentContainerStyle={[
          styles.listContent,
          (viewMode === 'list' || viewMode === 'magazine') && { paddingHorizontal: 0, paddingVertical: 0 },
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />

      {isLoading && favorites.length === 0 && (
        <View style={[styles.loadingOverlay, { backgroundColor: isDarkMode ? 'rgba(18,18,18,0.9)' : 'rgba(255,255,255,0.9)' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading favorites...</Text>
        </View>
      )}
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: fontSize.xxLarge, fontWeight: 'bold', color: colors.primary },
  countBadge: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  countText: { color: colors.white, fontSize: fontSize.small, fontWeight: '600' },
  viewToggleBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  viewToggleText: { fontSize: 18 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: 'white', fontSize: 13, fontWeight: '700' },
  checkboxContainer: { justifyContent: 'center', marginRight: 10 },
  deleteBtn: { backgroundColor: '#dc3545', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  deleteBtnText: { color: 'white', fontSize: fontSize.small, fontWeight: '700' },

  // Home.js 準拠のカテゴリ帯
  sectionHeader: { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: colors.primary },
  sectionHeaderText: { fontSize: fontSize.small, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: 'white' },

  listContent: { paddingHorizontal: 12, paddingVertical: 8, flexGrow: 1 },

  // Home.js 準拠のビューレイアウト
  articleCard: { borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, flexDirection: 'row', padding: 12 },
  articleListRow: { flexDirection: 'row', padding: 12, paddingHorizontal: 16, alignItems: 'center' },
  articleMagazine: { borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, flexDirection: 'column', padding: 12 },

  thumbnailCard: { width: 80, height: 80, backgroundColor: '#e0e0e0', borderRadius: 8 },
  thumbnailMagazine: { width: '100%', height: 160, backgroundColor: '#e0e0e0', borderRadius: 8, marginBottom: 12 },
  noThumbnailCard: { width: 80, height: 80, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  noThumbnailMagazine: { width: '100%', height: 160, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  noThumbnailText: { fontSize: fontSize.xSmall },

  articleContent: { flex: 1, marginLeft: 10, justifyContent: 'center' },
  articleMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  favicon: { width: 14, height: 14, borderRadius: 2, marginRight: 6 },
  feedTitleText: { fontSize: fontSize.small, fontWeight: '600' },
  dot: { marginHorizontal: 4 },
  time: { fontSize: fontSize.small },
  articleTitle: { fontSize: fontSize.normal, fontWeight: '600', marginBottom: 4, lineHeight: 20 },
  articleDescription: { fontSize: fontSize.small, lineHeight: 18 },

  removingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center', borderRadius: 12 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingTop: 100 },
  emptyIcon: { fontSize: 48, color: colors.primary, marginBottom: 16 },
  emptyTitle: { fontSize: fontSize.xLarge, fontWeight: '600', marginBottom: 8 },
  emptyText: { fontSize: fontSize.normal, textAlign: 'center', lineHeight: 22 },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: fontSize.normal },
})