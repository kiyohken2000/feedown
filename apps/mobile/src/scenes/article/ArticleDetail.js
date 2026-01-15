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
import { UserContext } from '../../contexts/UserContext'
import { useTheme } from '../../contexts/ThemeContext'
import ScreenTemplate from '../../components/ScreenTemplate'
import ArticleReader from '../../components/ArticleReader'
import { createApiClient } from '../../utils/api'
import { showToast, showErrorToast } from '../../utils/showToast'

export default function ArticleDetail() {
  const navigation = useNavigation()
  const route = useRoute()
  const { article } = route.params
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)

  const { getAccessToken } = useContext(UserContext)
  const {
    readArticles,
    favoritedArticles,
    markAsRead,
    toggleFavorite,
  } = useContext(FeedsContext)

  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false)
  const [readerMode, setReaderMode] = useState(false)
  const [readerContent, setReaderContent] = useState(null)
  const [isLoadingReader, setIsLoadingReader] = useState(false)
  const [readerError, setReaderError] = useState(null)

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

  // Handle Reader Mode toggle
  const handleReaderMode = useCallback(async () => {
    if (readerMode) {
      // Exit reader mode
      setReaderMode(false)
      return
    }

    // If already loaded, just show
    if (readerContent) {
      setReaderMode(true)
      return
    }

    // Load article content
    setIsLoadingReader(true)
    setReaderError(null)

    try {
      const api = createApiClient(getAccessToken)
      const response = await api.articles.getContent(article.url)

      if (response.success && response.data?.article?.content) {
        setReaderContent(response.data.article)
        setReaderMode(true)
      } else {
        setReaderError(response.data?.error || 'Could not extract article content')
        showErrorToast({
          title: 'Reader Mode Unavailable',
          body: 'Could not extract article content. Try "Visit Original" instead.',
        })
      }
    } catch (err) {
      console.error('Reader mode error:', err)
      setReaderError(err.message)
      showErrorToast({
        title: 'Error',
        body: 'Failed to load article content',
      })
    } finally {
      setIsLoadingReader(false)
    }
  }, [readerMode, readerContent, article.url, getAccessToken])

  // Handle link press in reader
  const handleLinkPress = useCallback((url) => {
    Linking.openURL(url)
  }, [])

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
        {readerMode && (
          <TouchableOpacity onPress={handleReaderMode} style={styles.exitReaderButton}>
            <Text style={[styles.exitReaderText, { color: theme.textMuted }]}>Exit Reader</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Reader Mode View */}
      {readerMode && readerContent ? (
        <ArticleReader
          article={readerContent}
          onLinkPress={handleLinkPress}
        />
      ) : (
        /* Default Article View */
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

          {/* Reader Mode Button */}
          <View style={styles.readerButtonContainer}>
            <TouchableOpacity
              style={[
                styles.readerButton,
                { backgroundColor: isDarkMode ? theme.card : colors.white, borderColor: theme.border },
                isLoadingReader && styles.readerButtonLoading,
              ]}
              onPress={handleReaderMode}
              disabled={isLoadingReader}
            >
              {isLoadingReader ? (
                <View style={styles.readerButtonContent}>
                  <ActivityIndicator size="small" color={colors.bluePrimary} />
                  <Text style={[styles.readerButtonText, { color: colors.bluePrimary, marginLeft: 8 }]}>
                    Loading...
                  </Text>
                </View>
              ) : (
                <View style={styles.readerButtonContent}>
                  <Text style={styles.readerIcon}>📖</Text>
                  <Text style={[styles.readerButtonText, { color: colors.bluePrimary }]}>
                    Reader Mode
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <Text style={[styles.readerHint, { color: theme.textMuted }]}>
              Read article in a clean, distraction-free format
            </Text>
          </View>

          {/* URL Info */}
          <View style={[styles.urlContainer, { backgroundColor: theme.surface }]}>
            <Text style={[styles.urlLabel, { color: theme.textMuted }]}>Source</Text>
            <Text style={[styles.urlText, { color: theme.textMuted }]} numberOfLines={2}>{article.url}</Text>
          </View>
        </ScrollView>
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
  exitReaderButton: {
    paddingVertical: 4,
    paddingLeft: 12,
  },
  exitReaderText: {
    fontSize: fontSize.normal,
    fontWeight: '500',
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
    marginBottom: 16,
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
  readerButtonContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  readerButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.grayLight,
  },
  readerButtonLoading: {
    opacity: 0.7,
  },
  readerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readerIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  readerButtonText: {
    fontSize: fontSize.normal,
    fontWeight: '600',
  },
  readerHint: {
    fontSize: fontSize.small,
    textAlign: 'center',
    marginTop: 8,
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
