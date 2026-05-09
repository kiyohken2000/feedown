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
  fact:        { label: 'Fact',        color: '#2563EB' },
  claim:       { label: 'Claim',       color: '#7C3AED' },
  speculation: { label: 'Speculation', color: '#D97706' },
  quote:       { label: 'Quote',       color: '#059669' },
  promotion:   { label: 'Promotion',   color: '#DC2626' },
  unclear:     { label: 'Unclear',     color: '#6B7280' },
}

const SIGNAL_ORDER = ['fact', 'claim', 'speculation', 'quote', 'promotion', 'unclear']

const CONFIDENCE_STYLE = {
  high:   { bg: 'rgba(5,150,105,0.12)',  text: '#059669' },
  medium: { bg: 'rgba(217,119,6,0.12)',  text: '#D97706' },
  low:    { bg: 'rgba(107,114,128,0.12)', text: '#6B7280' },
}

function ConfidenceBadge({ confidence }) {
  const style = CONFIDENCE_STYLE[confidence] ?? CONFIDENCE_STYLE.low
  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]}>
      <Text style={[styles.badgeText, { color: style.text }]}>{confidence}</Text>
    </View>
  )
}

function SignalGroup({ type, items, theme }) {
  const meta = SIGNAL_META[type]
  if (!meta || items.length === 0) return null
  return (
    <View style={styles.group}>
      <View style={[styles.groupHeader, { borderLeftColor: meta.color }]}>
        <Text style={[styles.groupLabel, { color: meta.color }]}>{meta.label}</Text>
      </View>
      {items.map((signal, i) => (
        <View key={i} style={[styles.signalRow, { borderBottomColor: theme.border }]}>
          <Text style={[styles.signalText, { color: theme.text }]}>{signal.text}</Text>
          <ConfidenceBadge confidence={signal.confidence} />
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
          Classify article content by signal type — facts, claims, speculation, and more
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

  if (result.insufficient || result.signals.length === 0) {
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

  // Group signals by type in defined order
  const grouped = {}
  for (const signal of result.signals) {
    if (!grouped[signal.type]) grouped[signal.type] = []
    grouped[signal.type].push(signal)
  }

  return (
    <View>
      {SIGNAL_ORDER.filter((t) => grouped[t]?.length > 0).map((type) => (
        <SignalGroup key={type} type={type} items={grouped[type]} theme={theme} />
      ))}
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  signalText: {
    flex: 1,
    fontSize: fontSize.normal,
    lineHeight: 22,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
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
