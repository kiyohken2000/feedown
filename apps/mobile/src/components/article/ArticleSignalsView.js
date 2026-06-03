import React from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { colors, fontSize } from '../../theme'

const SIGNAL_META = {
  facts:  { label: 'Facts',  color: '#2563EB' },
  claims: { label: 'Claims', color: '#7C3AED' },
  quotes: { label: 'Quotes', color: '#059669' },
}

const SIGNAL_ORDER = ['facts', 'claims', 'quotes']

function SignalGroup({ type, items, theme }) {
  const meta = SIGNAL_META[type]
  if (!meta || items.length === 0) return null
  return (
    <View style={styles.group}>
      <View style={[styles.groupHeader, { borderLeftColor: meta.color }]}>
        <Text style={[styles.groupLabel, { color: meta.color }]}>{meta.label}</Text>
      </View>
      {items.map((text, i) => (
        <View key={i} style={[styles.signalRow, { borderBottomColor: theme.border }]}>
          <Text style={[styles.signalText, { color: theme.text }]}>{text}</Text>
        </View>
      ))}
    </View>
  )
}

export default function ArticleSignalsView({
  result,
  isGenerating,
  error,
  onGenerate,
  onInterrupt,
  theme,
}) {
  if (isGenerating) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.stateText, { color: theme.textSecondary }]}>
          Analyzing signals...
        </Text>
        <TouchableOpacity style={styles.interruptButton} onPress={onInterrupt}>
          <Text style={styles.interruptButtonText}>Stop</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.stateContainer}>
        <Text style={[styles.errorText, { color: colors.redSecondary }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.actionButton, { borderColor: colors.primary }]}
          onPress={onGenerate}
        >
          <Text style={[styles.actionButtonText, { color: colors.primary }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!result) {
    return (
      <View style={styles.stateContainer}>
        <Text style={[styles.stateText, { color: theme.textMuted }]}>
          Classify article content into facts, claims, and quotes
        </Text>
        <TouchableOpacity
          style={[styles.actionButton, { borderColor: colors.primary }]}
          onPress={onGenerate}
        >
          <Text style={[styles.actionButtonText, { color: colors.primary }]}>Analyze Signals</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const isEmpty =
    !result.facts?.length && !result.claims?.length && !result.quotes?.length
  if (isEmpty) {
    return (
      <View style={styles.stateContainer}>
        <Text style={[styles.stateText, { color: theme.textMuted }]}>
          Not enough content to classify signals in this article.
        </Text>
        <TouchableOpacity style={styles.regenerateRow} onPress={() => onGenerate({ force: true })}>
          <Text style={[styles.regenerateText, { color: theme.textMuted }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View>
      {SIGNAL_ORDER.map((type) => {
        const items = result[type] ?? []
        if (items.length === 0) return null
        return <SignalGroup key={type} type={type} items={items} theme={theme} />
      })}
      <TouchableOpacity style={styles.regenerateRow} onPress={() => onGenerate({ force: true })}>
        <Text style={[styles.regenerateText, { color: theme.textMuted }]}>Regenerate</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  stateContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  stateText: {
    fontSize: fontSize.normal,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorText: {
    fontSize: fontSize.normal,
    textAlign: 'center',
  },
  actionButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  actionButtonText: {
    fontSize: fontSize.normal,
    fontWeight: '600',
  },
  group: {
    marginBottom: 14,
  },
  groupHeader: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    marginBottom: 6,
  },
  groupLabel: {
    fontSize: fontSize.small,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  signalRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  signalText: {
    fontSize: fontSize.normal,
    lineHeight: 22,
  },
  regenerateRow: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  regenerateText: {
    fontSize: fontSize.small,
  },
  interruptButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.redSecondary,
  },
  interruptButtonText: {
    fontSize: fontSize.small,
    color: colors.redSecondary,
    fontWeight: '600',
  },
})
