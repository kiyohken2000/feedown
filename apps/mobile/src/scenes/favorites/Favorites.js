import React, { useContext, useEffect, useCallback, useState } from 'react'
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { colors, fontSize } from '../../theme'
import { FeedsContext } from '../../contexts/FeedsContext'
import ScreenTemplate from '../../components/ScreenTemplate'
import { showToast, showErrorToast } from '../../utils/showToast'

export default function Favorites() {
  const navigation = useNavigation()
  const {
    favorites,
    fetchFavorites,
    toggleFavorite,
    isLoading,
  } = useContext(FeedsContext)

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [removingId, setRemovingId] = useState(null)

  // Initial load
  useEffect(() => {
    fetchFavorites()
  }, [])

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await fetchFavorites()
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchFavorites])

  // Handle remove from favorites
  const handleRemoveFavorite = useCallback((favorite) => {
    Alert.alert(
      'Remove Favorite',
      `Remove "${favorite.title}" from favorites?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingId(favorite.articleId)
            try {
              await toggleFavorite({ id: favorite.articleId })
              showToast({ title: 'Removed', body: 'Removed from favorites' })
            } catch (err) {
              showErrorToast({ title: 'Error', body: 'Failed to remove favorite' })
            } finally {
              setRemovingId(null)
            }
          },
        },
      ]
    )
  }, [toggleFavorite])

  // Navigate to article detail
  const handleArticlePress = useCallback((favorite) => {
    // Convert favorite to article format for ArticleDetail
    const article = {
      id: favorite.articleId,
      title: favorite.title,
      url: favorite.url,
      description: favorite.description,
      feedTitle: favorite.feedTitle,
      imageUrl: favorite.imageUrl,
      publishedAt: favorite.createdAt,
    }
    navigation.navigate('FavoriteDetail', { article })
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

  // Render favorite item
  const renderFavorite = ({ item: favorite }) => {
    const isRemoving = removingId === favorite.articleId

    return (
      <TouchableOpacity
        style={styles.favoriteCard}
        onPress={() => handleArticlePress(favorite)}
        activeOpacity={0.7}
        disabled={isRemoving}
      >
        {favorite.imageUrl ? (
          <Image
            source={{ uri: favorite.imageUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.noThumbnail}>
            <Text style={styles.noThumbnailText}>No image</Text>
          </View>
        )}
        <View style={styles.favoriteContent}>
          <View style={styles.favoriteMeta}>
            <Text style={styles.feedTitle} numberOfLines={1}>
              {favorite.feedTitle || 'Unknown Feed'}
            </Text>
            <Text style={styles.dot}>-</Text>
            <Text style={styles.time}>{getRelativeTime(favorite.createdAt)}</Text>
          </View>
          <Text style={styles.favoriteTitle} numberOfLines={2}>
            {favorite.title}
          </Text>
          {favorite.description && (
            <Text style={styles.favoriteDescription} numberOfLines={2}>
              {favorite.description}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveFavorite(favorite)}
          disabled={isRemoving}
        >
          {isRemoving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.removeButtonText}>Remove</Text>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    )
  }

  // Render empty state
  const renderEmpty = () => {
    if (isLoading || isRefreshing) return null

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>★</Text>
        <Text style={styles.emptyTitle}>No favorites yet</Text>
        <Text style={styles.emptyText}>
          Articles you favorite will appear here. Tap the star on any article to save it.
        </Text>
      </View>
    )
  }

  return (
    <ScreenTemplate>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Favorites</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{favorites.length} saved</Text>
        </View>
      </View>

      <FlatList
        data={favorites}
        renderItem={renderFavorite}
        keyExtractor={(item) => item.id || item.articleId}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />

      {isLoading && favorites.length === 0 && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading favorites...</Text>
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
  countBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    color: colors.white,
    fontSize: fontSize.small,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexGrow: 1,
  },
  favoriteCard: {
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
  thumbnail: {
    width: '100%',
    height: 140,
    backgroundColor: colors.grayLight,
  },
  noThumbnail: {
    width: '100%',
    height: 70,
    backgroundColor: colors.grayLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noThumbnailText: {
    color: colors.gray,
    fontSize: fontSize.small,
  },
  favoriteContent: {
    padding: 12,
  },
  favoriteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
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
  favoriteTitle: {
    fontSize: fontSize.large,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 4,
    lineHeight: 22,
  },
  favoriteDescription: {
    fontSize: fontSize.normal,
    color: colors.gray,
    lineHeight: 20,
  },
  removeButton: {
    backgroundColor: colors.redSecondary || '#dc3545',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: colors.white,
    fontSize: fontSize.normal,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 48,
    color: colors.primary,
    marginBottom: 16,
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
