import React, { useContext, useEffect, useState, useCallback } from 'react'
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Linking,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { colors, fontSize, getThemeColors } from '../../theme'
import { FeedsContext } from '../../contexts/FeedsContext'
import { useTheme } from '../../contexts/ThemeContext'
import ScreenTemplate from '../../components/ScreenTemplate'
import { showToast, showErrorToast } from '../../utils/showToast'

export default function ArticleDetail() {
  const navigation = useNavigation()
  const route = useRoute()
  const { article } = route.params
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)

  const {
    readArticles,
    favoritedArticles,
    markAsRead,
    toggleFavorite,
  } = useContext(FeedsContext)

  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false)
  const isFavorited = favoritedArticles.has(article.id)

  // Mark as read when screen opens
  useEffect(() => {
    if (!readArticles.has(article.id)) {
      markAsRead(article.id)
    }
  }, [article.id, readArticles, markAsRead])

  // Handle toggle favorite
  const handleToggleFavorite = useCallback(async () => {
    setIsTogglingFavorite(true)
    try {
      await toggleFavorite(article)
      showToast({
        title: isFavorited ? 'Removed' : 'Added',
        body: isFavorited ? 'Removed from favorites' : 'Added to favorites',
      })
    } catch (err) {
      showErrorToast({ title: 'Error', body: 'Failed to update favorite' })
    } finally {
      setIsTogglingFavorite(false)
    }
  }, [article, isFavorited, toggleFavorite])

  // Handle visit original
  const handleVisitOriginal = useCallback(async () => {
    if (article.url) {
      try {
        await Linking.openURL(article.url)
      } catch (err) {
        showErrorToast({ title: 'Error', body: 'Failed to open URL' })
      }
    }
  }, [article.url])

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
      return `${minutes} minutes ago`
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return `${hours} hours ago`
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400)
      return `${days} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  return (
    <ScreenTemplate>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.contentContainer}>
        {/* Article Image */}
        {article.imageUrl && (
          <Image
            source={{ uri: article.imageUrl }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        )}

        {/* Article Meta */}
        <View style={styles.metaContainer}>
          <Text style={styles.feedTitle}>{article.feedTitle || 'Unknown Feed'}</Text>
          <Text style={[styles.publishDate, { color: theme.textMuted }]}>{getRelativeTime(article.publishedAt)}</Text>
        </View>

        {/* Article Title */}
        <Text style={[styles.title, { color: theme.text }]}>{article.title}</Text>

        {/* Article Description */}
        {article.description && (
          <Text style={[styles.description, { color: theme.textSecondary }]}>{article.description}</Text>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.favoriteButton,
              { backgroundColor: isDarkMode ? theme.card : colors.white },
              isFavorited && styles.favoriteButtonActive,
            ]}
            onPress={handleToggleFavorite}
            disabled={isTogglingFavorite}
          >
            {isTogglingFavorite ? (
              <ActivityIndicator size="small" color={isFavorited ? colors.white : colors.primary} />
            ) : (
              <Text
                style={[
                  styles.actionButtonText,
                  isFavorited && styles.actionButtonTextActive,
                ]}
              >
                {isFavorited ? '★ In Favorites' : '☆ Add to Favorites'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.visitButton]}
            onPress={handleVisitOriginal}
          >
            <Text style={styles.visitButtonText}>Visit Original →</Text>
          </TouchableOpacity>
        </View>

        {/* URL Info */}
        <View style={[styles.urlContainer, { backgroundColor: theme.surface }]}>
          <Text style={[styles.urlLabel, { color: theme.textMuted }]}>Source</Text>
          <Text style={[styles.urlText, { color: theme.textMuted }]} numberOfLines={2}>{article.url}</Text>
        </View>
      </ScrollView>
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
    backgroundColor: colors.white,
  },
  backButton: {
    paddingVertical: 4,
    paddingRight: 12,
  },
  backButtonText: {
    fontSize: fontSize.normal,
    color: colors.primary,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  heroImage: {
    width: '100%',
    height: 220,
    backgroundColor: colors.grayLight,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  feedTitle: {
    fontSize: fontSize.normal,
    fontWeight: '600',
    color: colors.primary,
  },
  publishDate: {
    fontSize: fontSize.small,
    color: colors.gray,
  },
  title: {
    fontSize: fontSize.xxLarge,
    fontWeight: 'bold',
    color: colors.black,
    paddingHorizontal: 16,
    marginBottom: 16,
    lineHeight: 32,
  },
  description: {
    fontSize: fontSize.large,
    color: colors.gray,
    paddingHorizontal: 16,
    lineHeight: 26,
    marginBottom: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButton: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  favoriteButtonActive: {
    backgroundColor: colors.primary,
  },
  actionButtonText: {
    fontSize: fontSize.normal,
    fontWeight: '600',
    color: colors.primary,
  },
  actionButtonTextActive: {
    color: colors.white,
  },
  visitButton: {
    backgroundColor: colors.primary,
  },
  visitButtonText: {
    fontSize: fontSize.normal,
    fontWeight: '600',
    color: colors.white,
  },
  urlContainer: {
    marginHorizontal: 16,
    padding: 12,
    backgroundColor: colors.grayLight,
    borderRadius: 8,
  },
  urlLabel: {
    fontSize: fontSize.small,
    fontWeight: '600',
    color: colors.gray,
    marginBottom: 4,
  },
  urlText: {
    fontSize: fontSize.small,
    color: colors.gray,
  },
})
