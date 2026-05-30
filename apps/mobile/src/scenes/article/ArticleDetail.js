import React, { useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Linking,
  ScrollView,
  Image,
  ActivityIndicator,
  Share,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { colors, fontSize, getThemeColors } from '../../theme'
import { FeedsContext } from '../../contexts/FeedsContext'
import { UserContext } from '../../contexts/UserContext'
import { useTheme } from '../../contexts/ThemeContext'
import ScreenTemplate from '../../components/ScreenTemplate'
import ArticleReader from '../../components/ArticleReader'
import ArticleAiPanel from '../../components/article/ArticleAiPanel'
import { useArticleTranslation } from '../../ai/useArticleTranslation'
import { useAi } from '../../contexts/AiContext'
import { detectLanguage } from '../../ai/languageDetect'
import { OUTPUT_LANGUAGES } from '../../ai/aiStorage'
import { createApiClient } from '../../utils/api'
import { showToast, showErrorToast } from '../../utils/showToast'

function getLanguageNativeName(code) {
  return OUTPUT_LANGUAGES.find((l) => l.code === code)?.nativeLabel ?? code
}

function getLanguageEnglishName(code) {
  return OUTPUT_LANGUAGES.find((l) => l.code === code)?.label ?? code
}

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
  const [translateBannerDismissed, setTranslateBannerDismissed] = useState(false)
  // Set when user taps the banner — once reader content loads and the
  // translation hook reports ready, the effect below fires translation
  // exactly once and clears this flag.
  const [autoTranslateRequested, setAutoTranslateRequested] = useState(false)
  const autoTranslatedRef = useRef(false)

  const translation = useArticleTranslation(article, readerContent)
  const { settings: aiSettings } = useAi()

  // Detect article language from the title + description (cheap; no reader
  // content needed). Used by the translate banner to decide whether to
  // surface translation at all.
  const detectedArticleLang = useMemo(() => {
    const sample = `${article.title ?? ''} ${article.description ?? ''}`.trim()
    if (sample.length < 30) return null
    return detectLanguage(sample)
  }, [article.title, article.description])

  const targetLang = aiSettings.outputLanguage ?? 'ja'
  const showTranslateBanner =
    !readerMode &&
    !translateBannerDismissed &&
    aiSettings.enabled &&
    detectedArticleLang &&
    detectedArticleLang !== targetLang

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

  // Banner: tap → enter reader (fetches content if needed) + remember
  // that translation should auto-start once everything is ready.
  const handleTranslateFromBanner = useCallback(() => {
    autoTranslatedRef.current = false
    setAutoTranslateRequested(true)
    setTranslateBannerDismissed(true)
    // handleReaderMode handles the fetch + setReaderMode(true). Defined below.
    handleReaderMode()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDismissTranslateBanner = useCallback(() => {
    setTranslateBannerDismissed(true)
  }, [])

  // Fires translation exactly once after the banner-triggered reader load
  // finishes. Skipped if a translation already exists for this article
  // (cache will return immediately anyway, but we keep the guard for
  // clarity).
  useEffect(() => {
    if (!autoTranslateRequested) return
    if (autoTranslatedRef.current) return
    if (!readerContent) return
    if (!translation.isModelReady) return
    if (!translation.paragraphs.length) return
    if (translation.translatedParagraphs) return
    autoTranslatedRef.current = true
    setAutoTranslateRequested(false)
    translation.translate()
  }, [
    autoTranslateRequested,
    readerContent,
    translation.isModelReady,
    translation.paragraphs.length,
    translation.translatedParagraphs,
    translation,
  ])

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

  // Handle share
  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `${article.title}\n\n${article.url}`,
        url: article.url,
        title: article.title,
      })
    } catch (err) {
      console.error('Share error:', err)
    }
  }, [article.title, article.url])

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
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
            <Text style={styles.shareButtonText}>Share</Text>
          </TouchableOpacity>
          {readerMode && (
            <TouchableOpacity onPress={handleReaderMode} style={styles.exitReaderButton}>
              <Text style={[styles.exitReaderText, { color: theme.textMuted }]}>Exit Reader</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Reader Mode View */}
      {readerMode && readerContent ? (
        <ArticleReader
          article={readerContent}
          onLinkPress={handleLinkPress}
          translation={translation}
        />
      ) : (
        /* Default Article View */
        <>
          <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.contentContainer}>
            {/* AI Panel — scrolls with article content */}
            <ArticleAiPanel article={article} readerContent={readerContent} />

            {/* Article Image */}
            {article.imageUrl && (
              <Image
                source={{ uri: article.imageUrl }}
                style={styles.heroImage}
                resizeMode="cover"
              />
            )}

            {/* Translate suggestion banner */}
            {showTranslateBanner && (
              <TouchableOpacity
                style={[styles.translateBanner, { backgroundColor: isDarkMode ? '#1a2a3a' : '#e8f1fb', borderColor: colors.bluePrimary || '#007AFF' }]}
                onPress={handleTranslateFromBanner}
                activeOpacity={0.7}
              >
                <Text style={styles.translateBannerIcon}>🌐</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.translateBannerTitle, { color: theme.text }]}>
                    This article is in {getLanguageEnglishName(detectedArticleLang)}
                  </Text>
                  <Text style={[styles.translateBannerSub, { color: colors.bluePrimary || '#007AFF' }]}>
                    Read in {getLanguageNativeName(targetLang)} →
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleDismissTranslateBanner}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.translateBannerDismiss}
                >
                  <Text style={[styles.translateBannerDismissText, { color: theme.textMuted }]}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
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

            {/* URL Info */}
            <View style={[styles.urlContainer, { backgroundColor: theme.surface }]}>
              <Text style={[styles.urlLabel, { color: theme.textMuted }]}>Source</Text>
              <Text style={[styles.urlText, { color: theme.textMuted }]} numberOfLines={2}>{article.url}</Text>
            </View>
          </ScrollView>

          {/* Fixed Bottom Action Bar */}
          <View style={[styles.bottomBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
            {/* Row 1: Favorite and Visit buttons */}
            <View style={styles.bottomButtonRow}>
              <TouchableOpacity
                style={[
                  styles.bottomButton,
                  styles.favoriteBottomButton,
                  { backgroundColor: isDarkMode ? theme.card : colors.white },
                  isFavorited && styles.favoriteBottomButtonActive,
                ]}
                onPress={handleToggleFavorite}
                disabled={isTogglingFavorite}
              >
                {isTogglingFavorite ? (
                  <ActivityIndicator size="small" color={isFavorited ? colors.white : colors.primary} />
                ) : (
                  <Text style={[styles.bottomButtonText, isFavorited && styles.bottomButtonTextActive]}>
                    {isFavorited ? '★ In Favorites' : '☆ Add to Favorites'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.bottomButton, styles.visitBottomButton]}
                onPress={handleVisitOriginal}
              >
                <Text style={styles.visitBottomButtonText}>Visit Original →</Text>
              </TouchableOpacity>
            </View>

            {/* Row 2: Reader Mode */}
            <View style={styles.bottomButtonRow}>
              <TouchableOpacity
                style={[styles.readerBottomButton, { flex: 1, backgroundColor: isDarkMode ? theme.card : colors.white }]}
                onPress={handleReaderMode}
                disabled={isLoadingReader}
              >
                {isLoadingReader ? (
                  <View style={styles.readerButtonContent}>
                    <ActivityIndicator size="small" color={colors.bluePrimary || '#007AFF'} />
                    <Text style={[styles.readerBottomButtonText, { marginLeft: 8 }]}>Loading...</Text>
                  </View>
                ) : (
                  <View style={styles.readerButtonContent}>
                    <Text style={styles.readerIcon}>📖</Text>
                    <Text style={styles.readerBottomButtonText}>Reader Mode</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shareButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  shareButtonText: {
    fontSize: fontSize.small,
    color: colors.white,
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
    paddingBottom: 180,
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
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.grayLight,
    backgroundColor: colors.white,
  },
  bottomButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bottomButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteBottomButton: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  favoriteBottomButtonActive: {
    backgroundColor: colors.primary,
  },
  bottomButtonText: {
    fontSize: fontSize.normal,
    fontWeight: '600',
    color: colors.primary,
  },
  bottomButtonTextActive: {
    color: colors.white,
  },
  readerBottomButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  readerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readerIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  readerBottomButtonText: {
    fontSize: fontSize.normal,
    fontWeight: '600',
    color: colors.bluePrimary || '#007AFF',
  },
  visitBottomButton: {
    backgroundColor: colors.primary,
  },
  visitBottomButtonText: {
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
  translateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  translateBannerIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  translateBannerTitle: {
    fontSize: fontSize.small,
    fontWeight: '600',
    marginBottom: 2,
  },
  translateBannerSub: {
    fontSize: fontSize.normal,
    fontWeight: '600',
  },
  translateBannerDismiss: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  translateBannerDismissText: {
    fontSize: 16,
    fontWeight: '600',
  },
})
