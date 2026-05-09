import React, { useContext, useEffect, useRef, useState } from 'react'
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useTheme } from '../../contexts/ThemeContext'
import { UserContext } from '../../contexts/UserContext'
import { colors, getThemeColors, fontSize } from '../../theme'
import { useArticleAi } from '../../ai/useArticleAi'
import { createApiClient } from '../../utils/api'
import ArticleChatView from '../../components/article/ArticleChatView'

export default function ArticleChatScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const { article, readerContent, outputLanguage } = route.params
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)
  const { getAccessToken } = useContext(UserContext)
  const [autoReader, setAutoReader] = useState(null)
  const fetchedUrlRef = useRef(null)
  const effectiveReaderContent = readerContent ?? autoReader
  const ai = useArticleAi(article, effectiveReaderContent)

  useEffect(() => {
    if (readerContent) return
    if (!article?.url) return
    if (fetchedUrlRef.current === article.url) return
    fetchedUrlRef.current = article.url
    let cancelled = false
    ;(async () => {
      try {
        const api = createApiClient(getAccessToken)
        const response = await api.articles.getContent(article.url)
        if (!cancelled && response.success && response.data?.article?.content) {
          setAutoReader(response.data.article)
        }
      } catch (_err) {
        // silent — fall back to RSS description
      }
    })()
    return () => { cancelled = true }
  }, [article?.url, readerContent, getAccessToken])

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.card }]}
      edges={['top', 'right', 'left', 'bottom']}
    >
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Article Chat</Text>
        <View style={styles.headerSide} />
      </View>

      {/* Article title context */}
      <View style={[styles.contextBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.contextText, { color: theme.textMuted }]} numberOfLines={1}>
          {article.title}
        </Text>
      </View>

      {/* Chat */}
      <View style={styles.body}>
        <ArticleChatView
          chatHistory={ai.chatHistory}
          isGenerating={ai.isGeneratingChat}
          error={ai.chatError}
          onSend={ai.sendChatMessage}
          onInterrupt={ai.interrupt}
          theme={theme}
          outputLanguage={outputLanguage ?? 'en'}
        />
      </View>
    </SafeAreaView>
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
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    minWidth: 64,
  },
  backText: {
    fontSize: fontSize.normal,
    fontWeight: '600',
  },
  headerSide: {
    minWidth: 64,
  },
  title: {
    fontSize: fontSize.large,
    fontWeight: '600',
    textAlign: 'center',
  },
  contextBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  contextText: {
    fontSize: fontSize.small,
  },
  body: {
    flex: 1,
  },
})
