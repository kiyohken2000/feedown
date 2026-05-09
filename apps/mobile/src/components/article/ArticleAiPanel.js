import React, { useContext, useEffect, useRef, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'
import { colors, fontSize, getThemeColors } from '../../theme'
import { useTheme } from '../../contexts/ThemeContext'
import { useAi } from '../../contexts/AiContext'
import { UserContext } from '../../contexts/UserContext'
import { useArticleAi, PERSPECTIVES } from '../../ai/useArticleAi'
import { createApiClient } from '../../utils/api'
import PerspectiveSummaryView from './PerspectiveSummaryView'
import ArticleSignalsView from './ArticleSignalsView'

const TABS = [...PERSPECTIVES, 'signals']

const TAB_LABELS = {
  brief:     'Brief',
  technical: 'Technical',
  critical:  'Critical',
  signals:   'Signals',
}

export default function ArticleAiPanel({ article, readerContent }) {
  const navigation = useNavigation()
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)
  const { settings, llm } = useAi()
  const { getAccessToken } = useContext(UserContext)
  // const { settings, llm, tts } = useAi()  // TTS: restore tts when re-enabling
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState('brief')
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

  if (!settings.enabled || !settings.downloadEnabled || !ai.isModelReady) {
    return null
  }

  const showChatButton = settings.enabled && settings.downloadEnabled && llm.isReady

  const handleTabPress = async (tab) => {
    if (tab === activeTab) return
    await Haptics.selectionAsync()
    setActiveTab(tab)
    if (PERSPECTIVES.includes(tab)) {
      ai.switchPerspective(tab)
    }
  }

  const isSummaryTab = PERSPECTIVES.includes(activeTab)
  const activeResult = isSummaryTab ? (ai.summaryResults[activeTab] ?? null) : null
  const activeError = isSummaryTab ? (ai.summaryErrors[activeTab] ?? null) : null
  const isActiveGenerating = isSummaryTab
    ? ai.isGeneratingSummary && ai.activePerspective === activeTab
    : ai.isGeneratingSignals

  function hasResult(tab) {
    if (PERSPECTIVES.includes(tab)) return !!ai.summaryResults[tab]
    if (tab === 'signals') return !!ai.signalsResult
    return false
  }

  return (
    <View style={[styles.panel, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>✨</Text>
          <Text style={[styles.headerTitle, { color: theme.text }]}>AI Summary</Text>
        </View>
        <Text style={[styles.chevron, { color: theme.textMuted }]}>
          {expanded ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.body, { borderTopColor: theme.border }]}>
          {/* Tab bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.tabBarScroll, { borderBottomColor: theme.border }]}
            contentContainerStyle={styles.tabBarContent}
          >
            {TABS.map((tab) => {
              const isActive = tab === activeTab
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => handleTabPress(tab)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.tabText,
                      { color: isActive ? colors.primary : theme.textMuted },
                      isActive && styles.tabTextActive,
                    ]}
                  >
                    {TAB_LABELS[tab]}
                  </Text>
                  {hasResult(tab) && !isActive && (
                    <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                  )}
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          {/* Content */}
          <View style={styles.contentArea}>
            {isSummaryTab ? (
              <PerspectiveSummaryView
                result={activeResult}
                isGenerating={isActiveGenerating}
                error={activeError}
                onGenerate={(opts) => ai.generateSummary(activeTab, opts)}
                onInterrupt={ai.interrupt}
                theme={theme}
                // tts={tts}  // TTS: uncomment to re-enable
              />
            ) : (
              <ArticleSignalsView
                result={ai.signalsResult}
                isGenerating={isActiveGenerating}
                error={ai.signalsError}
                onGenerate={(opts) => ai.generateSignals(opts)}
                onInterrupt={ai.interrupt}
                theme={theme}
              />
            )}
          </View>

        </View>
      )}

      {/* Chat button — always visible when model is ready */}
      {showChatButton && (
        <TouchableOpacity
          style={[styles.chatButton, { borderTopColor: theme.border }]}
          onPress={() => navigation.navigate('ArticleChat', {
            article,
            readerContent: effectiveReaderContent,
            outputLanguage: settings.outputLanguage ?? 'en',
          })}
          activeOpacity={0.7}
        >
          <Text style={styles.chatIcon}>💬</Text>
          <Text style={[styles.chatButtonText, { color: colors.primary }]}>Chat about this article</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: 0,
    marginVertical: 0,
    borderRadius: 0,
    borderTopWidth: 0,
    borderBottomWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIcon: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: fontSize.normal,
    fontWeight: '600',
  },
  chevron: {
    fontSize: fontSize.small,
  },
  body: {
    borderTopWidth: 1,
  },
  tabBarScroll: {
    borderBottomWidth: 1,
  },
  tabBarContent: {
    paddingHorizontal: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: fontSize.small,
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  contentArea: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 12,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderTopWidth: 1,
  },
  chatIcon: {
    fontSize: 16,
  },
  chatButtonText: {
    fontSize: fontSize.normal,
    fontWeight: '600',
  },
})
