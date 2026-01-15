import React, { useContext, useEffect, useState, useCallback, useMemo } from 'react'
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { colors, fontSize } from '../../theme'
import { FeedsContext } from '../../contexts/FeedsContext'
import ScreenTemplate from '../../components/ScreenTemplate'
import { showToast, showErrorToast } from '../../utils/showToast'

// Recommended feeds list (same as Web)
const RECOMMENDED_FEEDS = [
  { name: 'AFP', url: 'http://feeds.afpbb.com/rss/afpbb/afpbbnews' },
  { name: 'BBC', url: 'http://feeds.bbci.co.uk/japanese/rss.xml' },
  { name: 'CNN', url: 'http://feeds.cnn.co.jp/rss/cnn/cnn.rdf' },
  { name: 'Rocket News 24', url: 'http://feeds.rocketnews24.com/rocketnews24' },
  { name: 'Weekly ASCII Plus', url: 'http://weekly.ascii.jp/cate/1/rss.xml' },
  { name: 'National Geographic', url: 'http://nationalgeographic.jp/nng/rss/index.rdf' },
  { name: 'Lifehacker', url: 'http://www.lifehacker.jp/index.xml' },
  { name: 'WIRED.jp', url: 'http://wired.jp/rssfeeder/' },
  { name: 'GIGAZINE', url: 'https://gigazine.net/news/rss_2.0/' },
  { name: 'Gizmodo', url: 'http://feeds.gizmodo.jp/rss/gizmodo/index.xml' },
  { name: 'CNET Japan', url: 'http://feed.japan.cnet.com/rss/index.rdf' },
  { name: 'AAPL Ch.', url: 'http://applech2.com/index.rdf' },
  { name: 'Kitamori Kawaraban', url: 'https://northwood.blog.fc2.com/?xml' },
  { name: 'EE Times Japan', url: 'https://rss.itmedia.co.jp/rss/2.0/eetimes.xml' },
]

export default function Read() {
  const {
    feeds,
    fetchFeeds,
    addFeed,
    deleteFeed,
    isLoading,
  } = useContext(FeedsContext)

  const [newFeedUrl, setNewFeedUrl] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [addingFeedUrl, setAddingFeedUrl] = useState(null)

  // Initial load
  useEffect(() => {
    fetchFeeds()
  }, [])

  // Get feed URLs that are already added
  const existingFeedUrls = useMemo(() => {
    return new Set(feeds.map(f => f.url.toLowerCase()))
  }, [feeds])

  // Filter recommended feeds to show only ones not already added
  const availableRecommendedFeeds = useMemo(() => {
    return RECOMMENDED_FEEDS.filter(rf => !existingFeedUrls.has(rf.url.toLowerCase()))
  }, [existingFeedUrls])

  // Handle add feed
  const handleAddFeed = useCallback(async () => {
    if (!newFeedUrl.trim()) {
      showErrorToast({ title: 'Error', body: 'Please enter a feed URL' })
      return
    }

    // Basic URL validation
    let url = newFeedUrl.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }

    setIsAdding(true)
    try {
      const result = await addFeed(url)
      if (result.success) {
        showToast({ title: 'Success', body: 'Feed added successfully' })
        setNewFeedUrl('')
      } else {
        showErrorToast({ title: 'Error', body: result.error || 'Failed to add feed' })
      }
    } catch (err) {
      showErrorToast({ title: 'Error', body: err.message })
    } finally {
      setIsAdding(false)
    }
  }, [newFeedUrl, addFeed])

  // Handle add recommended feed
  const handleAddRecommendedFeed = useCallback(async (recommendedFeed) => {
    setAddingFeedUrl(recommendedFeed.url)
    try {
      const result = await addFeed(recommendedFeed.url)
      if (result.success) {
        showToast({ title: 'Added', body: `${recommendedFeed.name} added successfully` })
      } else {
        showErrorToast({ title: 'Error', body: result.error || 'Failed to add feed' })
      }
    } catch (err) {
      showErrorToast({ title: 'Error', body: err.message })
    } finally {
      setAddingFeedUrl(null)
    }
  }, [addFeed])

  // Handle delete feed
  const handleDeleteFeed = useCallback((feed) => {
    Alert.alert(
      'Delete Feed',
      `Are you sure you want to delete "${feed.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteFeed(feed.id)
            if (result.success) {
              showToast({ title: 'Deleted', body: 'Feed removed successfully' })
            } else {
              showErrorToast({ title: 'Error', body: result.error || 'Failed to delete feed' })
            }
          },
        },
      ]
    )
  }, [deleteFeed])

  // Render feed item
  const renderFeed = ({ item: feed }) => (
    <View style={styles.feedCard}>
      <View style={styles.feedInfo}>
        {feed.faviconUrl ? (
          <Image
            source={{ uri: feed.faviconUrl }}
            style={styles.favicon}
          />
        ) : (
          <View style={[styles.favicon, styles.faviconPlaceholder]}>
            <Text style={styles.faviconPlaceholderText}>
              {feed.title?.charAt(0)?.toUpperCase() || 'F'}
            </Text>
          </View>
        )}
        <View style={styles.feedDetails}>
          <Text style={styles.feedTitle} numberOfLines={1}>
            {feed.title || 'Untitled Feed'}
          </Text>
          <Text style={styles.feedUrl} numberOfLines={1}>
            {feed.url}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteFeed(feed)}
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  )

  // Render recommended feed item
  const renderRecommendedFeed = (recommendedFeed) => {
    const isAddingThis = addingFeedUrl === recommendedFeed.url

    return (
      <TouchableOpacity
        key={recommendedFeed.url}
        style={styles.recommendedCard}
        onPress={() => handleAddRecommendedFeed(recommendedFeed)}
        disabled={isAddingThis}
        activeOpacity={0.7}
      >
        <View style={styles.recommendedInfo}>
          <View style={[styles.recommendedIcon]}>
            <Text style={styles.recommendedIconText}>
              {recommendedFeed.name.charAt(0)}
            </Text>
          </View>
          <Text style={styles.recommendedName}>{recommendedFeed.name}</Text>
        </View>
        {isAddingThis ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.addText}>+ Add</Text>
        )}
      </TouchableOpacity>
    )
  }

  // Render list header (recommended feeds section)
  const renderListHeader = () => {
    if (availableRecommendedFeeds.length === 0) return null

    return (
      <View style={styles.recommendedSection}>
        <Text style={styles.sectionTitle}>Recommended Feeds</Text>
        <View style={styles.recommendedGrid}>
          {availableRecommendedFeeds.map(renderRecommendedFeed)}
        </View>
        {feeds.length > 0 && (
          <Text style={styles.sectionTitle}>Your Feeds</Text>
        )}
      </View>
    )
  }

  // Render empty state (only show if no recommended feeds available)
  const renderEmpty = () => {
    if (isLoading) return null
    if (availableRecommendedFeeds.length > 0) return null

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>All feeds added!</Text>
        <Text style={styles.emptyText}>
          You've added all recommended feeds. Enter a custom RSS URL to add more.
        </Text>
      </View>
    )
  }

  return (
    <ScreenTemplate>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Manage Feeds</Text>
          <Text style={styles.feedCount}>{feeds.length} feeds</Text>
        </View>

        {/* Add feed form */}
        <View style={styles.addFeedContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter RSS feed URL..."
            placeholderTextColor={colors.gray}
            value={newFeedUrl}
            onChangeText={setNewFeedUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={handleAddFeed}
          />
          <TouchableOpacity
            style={[styles.addButton, isAdding && styles.addButtonDisabled]}
            onPress={handleAddFeed}
            disabled={isAdding}
          >
            {isAdding ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.addButtonText}>Add</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Feeds list */}
        <FlatList
          data={feeds}
          renderItem={renderFeed}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />

        {isLoading && feeds.length === 0 && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
      </KeyboardAvoidingView>
    </ScreenTemplate>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  feedCount: {
    fontSize: fontSize.normal,
    color: colors.gray,
  },
  addFeedContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: fontSize.normal,
    borderWidth: 1,
    borderColor: colors.grayLight,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  addButtonDisabled: {
    opacity: 0.7,
  },
  addButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSize.normal,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 20,
    flexGrow: 1,
  },
  // Recommended feeds section
  recommendedSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: fontSize.normal,
    fontWeight: '600',
    color: colors.gray,
    marginBottom: 10,
    marginTop: 8,
  },
  recommendedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recommendedCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '48.5%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.grayLight,
  },
  recommendedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recommendedIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  recommendedIconText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: fontSize.small,
  },
  recommendedName: {
    fontSize: fontSize.small,
    fontWeight: '500',
    color: colors.black,
    flex: 1,
  },
  addText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: fontSize.small,
    marginLeft: 6,
  },
  // Feed card
  feedCard: {
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 12,
    marginVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  feedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  favicon: {
    width: 36,
    height: 36,
    borderRadius: 6,
    marginRight: 12,
  },
  faviconPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faviconPlaceholderText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: fontSize.large,
  },
  feedDetails: {
    flex: 1,
  },
  feedTitle: {
    fontSize: fontSize.normal,
    fontWeight: '600',
    color: colors.black,
    marginBottom: 2,
  },
  feedUrl: {
    fontSize: fontSize.small,
    color: colors.gray,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.redSecondary,
  },
  deleteButtonText: {
    color: colors.white,
    fontSize: fontSize.small,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 40,
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
})
