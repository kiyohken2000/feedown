import React, { useMemo } from 'react'
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  useWindowDimensions,
  Linking,
} from 'react-native'
import RenderHtml from 'react-native-render-html'
import { colors, fontSize, getThemeColors } from '../theme'
import { useTheme } from '../contexts/ThemeContext'

export default function ArticleReader({ article, onLinkPress }) {
  const { width } = useWindowDimensions()
  const { isDarkMode } = useTheme()
  const theme = getThemeColors(isDarkMode)
  const contentWidth = width - 32

  // Define tag styles for rendering HTML
  const tagsStyles = useMemo(() => ({
    body: {
      color: theme.text,
      fontSize: 17,
      lineHeight: 28,
    },
    p: {
      marginBottom: 16,
      color: theme.text,
    },
    h1: {
      fontSize: 26,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 16,
      marginTop: 24,
    },
    h2: {
      fontSize: 22,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 14,
      marginTop: 20,
    },
    h3: {
      fontSize: 19,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 12,
      marginTop: 18,
    },
    h4: {
      fontSize: 17,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 10,
      marginTop: 16,
    },
    a: {
      color: colors.primary,
      textDecorationLine: 'underline',
    },
    img: {
      marginVertical: 16,
    },
    figure: {
      marginVertical: 16,
      marginHorizontal: 0,
    },
    figcaption: {
      fontSize: 14,
      color: theme.textMuted,
      textAlign: 'center',
      marginTop: 8,
    },
    blockquote: {
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
      paddingLeft: 16,
      marginVertical: 16,
      marginHorizontal: 0,
      fontStyle: 'italic',
      color: theme.textSecondary,
    },
    pre: {
      backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5',
      padding: 12,
      borderRadius: 8,
      marginVertical: 16,
      overflow: 'scroll',
    },
    code: {
      fontFamily: 'monospace',
      fontSize: 14,
      backgroundColor: isDarkMode ? '#1e1e1e' : '#f5f5f5',
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
    },
    ul: {
      marginVertical: 12,
      paddingLeft: 20,
    },
    ol: {
      marginVertical: 12,
      paddingLeft: 20,
    },
    li: {
      marginBottom: 8,
      color: theme.text,
    },
    table: {
      marginVertical: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    th: {
      backgroundColor: isDarkMode ? '#2d2d2d' : '#f0f0f0',
      padding: 8,
      fontWeight: 'bold',
      color: theme.text,
    },
    td: {
      padding: 8,
      borderWidth: 1,
      borderColor: theme.border,
      color: theme.text,
    },
    hr: {
      marginVertical: 24,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    strong: {
      fontWeight: 'bold',
    },
    em: {
      fontStyle: 'italic',
    },
  }), [theme, isDarkMode])

  // Custom renderers for specific tags
  const renderers = useMemo(() => ({
    // Custom link handler
    a: ({ TDefaultRenderer, tnode, ...props }) => {
      const href = tnode.attributes.href
      return (
        <TDefaultRenderer
          {...props}
          tnode={tnode}
          onPress={() => {
            if (href) {
              if (onLinkPress) {
                onLinkPress(href)
              } else {
                Linking.openURL(href)
              }
            }
          }}
        />
      )
    },
  }), [onLinkPress])

  // Render props for images
  const renderersProps = useMemo(() => ({
    img: {
      enableExperimentalPercentWidth: true,
    },
  }), [])

  if (!article || !article.content) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.textMuted }]}>
          No content available
        </Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Article Header */}
      <View style={styles.header}>
        {article.title && (
          <Text style={[styles.title, { color: theme.text }]}>
            {article.title}
          </Text>
        )}
        {(article.byline || article.siteName) && (
          <Text style={[styles.meta, { color: theme.textMuted }]}>
            {article.byline && article.byline}
            {article.byline && article.siteName && ' • '}
            {article.siteName && article.siteName}
          </Text>
        )}
      </View>

      {/* Article Content */}
      <View style={styles.content}>
        <RenderHtml
          contentWidth={contentWidth}
          source={{ html: article.content }}
          tagsStyles={tagsStyles}
          renderers={renderers}
          renderersProps={renderersProps}
          enableExperimentalMarginCollapsing={true}
          defaultTextProps={{
            selectable: true,
          }}
        />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 32,
    marginBottom: 12,
  },
  meta: {
    fontSize: fontSize.normal,
    lineHeight: 22,
  },
  content: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: fontSize.normal,
    textAlign: 'center',
  },
})
