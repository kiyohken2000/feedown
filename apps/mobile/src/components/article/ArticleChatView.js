import React, { useCallback } from 'react'
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { GiftedChat, Bubble, InputToolbar, Send, Composer, MessageText } from 'react-native-gifted-chat'
import { colors, fontSize } from '../../theme'

const QUICK_QUESTIONS = {
  en: [
    "What are the key points?",
    "What claims lack evidence?",
    "What's new or notable?",
    "What are the technical implications?",
    "What should I verify independently?",
    "What questions does this leave unanswered?",
  ],
  ja: [
    "この記事のポイントは？",
    "根拠が弱い主張は？",
    "何が新しい・注目すべき点は？",
    "技術的な影響は？",
    "自分で確認すべき点は？",
    "この記事だけでは答えられない疑問は？",
  ],
  ko: [
    "이 기사의 핵심 포인트는?",
    "근거가 부족한 주장은?",
    "새롭거나 주목할 점은?",
    "기술적인 영향은?",
    "직접 확인해야 할 점은?",
    "이 기사만으로 답할 수 없는 질문은?",
  ],
  zh: [
    "文章的要点是什么？",
    "哪些说法缺乏依据？",
    "有什么新颖或值得关注的内容？",
    "有哪些技术影响？",
    "有哪些需要独立核实的内容？",
    "这篇文章留下了哪些未解答的问题？",
  ],
}

const PLACEHOLDERS = {
  en: 'Ask about this article...',
  ja: 'この記事について質問する...',
  ko: '이 기사에 대해 질문하세요...',
  zh: '关于这篇文章提问...',
}

const EMPTY_TITLES = {
  en: 'Ask about this article',
  ja: 'この記事について質問する',
  ko: '이 기사에 대해 질문하세요',
  zh: '关于这篇文章提问',
}

function toGiftedMessages(chatHistory) {
  return [...chatHistory]
    .reverse()
    .map((msg) => ({
      _id: msg.id,
      text: msg.content,
      createdAt: new Date(msg.createdAt),
      user: msg.role === 'user'
        ? { _id: 1 }
        : { _id: 2, name: 'AI' },
    }))
}

// Inline markdown: **bold**, *italic*, `code`
function InlineMarkdown({ text, baseStyle, codeStyle }) {
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/gs
  const segments = []
  let last = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) segments.push({ type: 't', c: text.slice(last, match.index) })
    if (match[1] != null) segments.push({ type: 'b', c: match[1] })
    else if (match[2] != null) segments.push({ type: 'i', c: match[2] })
    else segments.push({ type: 'c', c: match[3] })
    last = match.index + match[0].length
  }
  if (last < text.length) segments.push({ type: 't', c: text.slice(last) })
  if (!segments.length) return <Text style={baseStyle}>{text}</Text>
  return (
    <Text style={baseStyle}>
      {segments.map((s, idx) => {
        if (s.type === 'b') return <Text key={idx} style={{ fontWeight: 'bold' }}>{s.c}</Text>
        if (s.type === 'i') return <Text key={idx} style={{ fontStyle: 'italic' }}>{s.c}</Text>
        if (s.type === 'c') return <Text key={idx} style={codeStyle}>{s.c}</Text>
        return s.c
      })}
    </Text>
  )
}

function MarkdownView({ text, textStyle }) {
  const monoFont = Platform.OS === 'ios' ? 'Courier' : 'monospace'
  const codeInlineStyle = { fontFamily: monoFont, backgroundColor: 'rgba(0,0,0,0.07)', borderRadius: 3 }
  const lines = text.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trimStart().startsWith('```')) {
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      elements.push(
        <View key={`cb${i}`} style={[mdStyles.codeBlock, { backgroundColor: 'rgba(0,0,0,0.07)' }]}>
          <Text style={[textStyle, { fontFamily: monoFont, fontSize: fontSize.small }]}>
            {codeLines.join('\n')}
          </Text>
        </View>
      )
    } else if (line.startsWith('# ')) {
      elements.push(
        <InlineMarkdown key={i} text={line.slice(2)}
          baseStyle={[textStyle, mdStyles.h1]} codeStyle={codeInlineStyle} />
      )
    } else if (line.startsWith('## ') || line.startsWith('### ')) {
      const depth = line.startsWith('### ') ? 4 : 3
      elements.push(
        <InlineMarkdown key={i} text={line.slice(depth)}
          baseStyle={[textStyle, mdStyles.h2]} codeStyle={codeInlineStyle} />
      )
    } else if (/^[-*] /.test(line)) {
      elements.push(
        <View key={i} style={mdStyles.bulletRow}>
          <Text style={textStyle}>{'• '}</Text>
          <InlineMarkdown text={line.slice(2)}
            baseStyle={[textStyle, { flex: 1 }]} codeStyle={codeInlineStyle} />
        </View>
      )
    } else if (/^\d+\. /.test(line)) {
      const m = line.match(/^(\d+)\. (.*)/)
      elements.push(
        <View key={i} style={mdStyles.bulletRow}>
          <Text style={textStyle}>{m[1]}{'). '}</Text>
          <InlineMarkdown text={m[2]}
            baseStyle={[textStyle, { flex: 1 }]} codeStyle={codeInlineStyle} />
        </View>
      )
    } else if (line === '') {
      elements.push(<View key={i} style={{ height: 6 }} />)
    } else {
      elements.push(
        <InlineMarkdown key={i} text={line}
          baseStyle={[textStyle, mdStyles.line]} codeStyle={codeInlineStyle} />
      )
    }
    i++
  }

  return <View style={mdStyles.container}>{elements}</View>
}

const mdStyles = StyleSheet.create({
  container: { margin: 3 },
  h1: { fontSize: fontSize.large, fontWeight: 'bold', marginTop: 6, marginBottom: 3 },
  h2: { fontWeight: 'bold', marginTop: 4, marginBottom: 2 },
  bulletRow: { flexDirection: 'row', marginVertical: 2 },
  line: { marginVertical: 1 },
  codeBlock: { borderRadius: 6, padding: 8, marginVertical: 4 },
})

export default function ArticleChatView({
  chatHistory,
  isGenerating,
  error,
  onSend,
  onInterrupt,
  theme,
  outputLanguage = 'en',
}) {
  const giftedMessages = toGiftedMessages(chatHistory)
  const questions = QUICK_QUESTIONS[outputLanguage] ?? QUICK_QUESTIONS.en
  const placeholder = PLACEHOLDERS[outputLanguage] ?? PLACEHOLDERS.en

  const handleSend = useCallback((messages) => {
    if (messages.length > 0 && !isGenerating) {
      onSend(messages[0].text)
    }
  }, [onSend, isGenerating])

  const handleQuickQuestion = (question) => {
    if (!isGenerating) onSend(question)
  }

  const renderBubble = (props) => (
    <Bubble
      {...props}
      wrapperStyle={{
        right: { backgroundColor: colors.primary },
        left: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
      }}
      textStyle={{
        right: { color: colors.white, fontSize: fontSize.normal, lineHeight: 22 },
        left: { color: theme.text, fontSize: fontSize.normal, lineHeight: 22 },
      }}
      timeTextStyle={{
        right: { color: 'rgba(255,255,255,0.7)', fontSize: 10 },
        left: { color: theme.textMuted, fontSize: 10 },
      }}
    />
  )

  const renderMessageText = (props) => {
    if (props.position === 'left') {
      return (
        <MarkdownView
          text={props.currentMessage.text}
          textStyle={{ color: theme.text, fontSize: fontSize.normal, lineHeight: 22 }}
        />
      )
    }
    return <MessageText {...props} />
  }

  const renderComposer = (props) => (
    <Composer
      {...props}
      textInputStyle={{ color: theme.text }}
      placeholderTextColor={theme.textMuted}
    />
  )

  const renderInputToolbar = (props) => (
    <InputToolbar
      {...props}
      containerStyle={[styles.inputToolbar, { backgroundColor: theme.card, borderTopColor: theme.border }]}
      primaryStyle={styles.inputPrimary}
    />
  )

  const renderSend = (props) => {
    if (isGenerating) {
      return (
        <TouchableOpacity style={styles.stopButton} onPress={onInterrupt}>
          <Text style={styles.stopButtonText}>Stop</Text>
        </TouchableOpacity>
      )
    }
    return (
      <Send {...props} alwaysShowSend containerStyle={styles.sendContainer}>
        <View style={[styles.sendButton, { backgroundColor: colors.primary }]}>
          <Text style={styles.sendButtonText}>↑</Text>
        </View>
      </Send>
    )
  }

  // renderChatEmpty is inside an inverted FlatList → needs scaleY: -1
  const renderChatEmpty = () => (
    <View style={styles.emptyOuter}>
      <Text style={[styles.emptyTitle, { color: theme.textMuted }]}>
        {EMPTY_TITLES[outputLanguage] ?? EMPTY_TITLES.en}
      </Text>
      <View style={styles.chipsContainer}>
        {questions.map((q) => (
          <TouchableOpacity
            key={q}
            style={[styles.chip, { borderColor: theme.border, backgroundColor: theme.surface }]}
            onPress={() => handleQuickQuestion(q)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, { color: theme.text }]}>{q}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )

  const renderChatFooter = () => {
    if (!error) return null
    return (
      <Text style={[styles.errorText, { color: colors.redSecondary }]}>{error}</Text>
    )
  }

  return (
    <GiftedChat
      messages={giftedMessages}
      onSend={handleSend}
      user={{ _id: 1 }}
      isTyping={isGenerating}
      placeholder={placeholder}
      renderBubble={renderBubble}
      renderMessageText={renderMessageText}
      renderComposer={renderComposer}
      renderInputToolbar={renderInputToolbar}
      renderSend={renderSend}
      renderChatEmpty={renderChatEmpty}
      renderChatFooter={renderChatFooter}
      renderAvatar={null}
      renderTime={() => null}
      alwaysShowSend
      scrollToBottom
      keyboardShouldPersistTaps="handled"
    />
  )
}

const styles = StyleSheet.create({
  inputToolbar: {
    borderTopWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  inputPrimary: {
    alignItems: 'center',
  },
  sendContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 20,
  },
  stopButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
    marginBottom: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.redSecondary,
  },
  stopButtonText: {
    fontSize: fontSize.small,
    color: colors.redSecondary,
    fontWeight: '600',
  },
  emptyOuter: {
    transform: [{ scaleY: -1 }],
    paddingHorizontal: 16,
    paddingTop: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: fontSize.small,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: fontSize.small,
    lineHeight: 18,
  },
  errorText: {
    fontSize: fontSize.small,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
})
