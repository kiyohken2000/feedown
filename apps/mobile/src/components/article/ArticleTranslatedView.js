import React from 'react'
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native'

// Renders translated content interleaved with images from the original
// article. Each entry in `blocks` is either { type: 'text', content } or
// { type: 'image', src, alt }, in the order they should appear.
// Legacy callers may still pass `paragraphs` (text-only); we render those
// the same way the old component did, with no images.
export default function ArticleTranslatedView({ blocks, paragraphs, theme, fontConfig }) {
  const { width } = useWindowDimensions()
  const imageWidth = width - 32

  const items = blocks
    ?? (paragraphs ?? []).map((content) => ({ type: 'text', content }))

  return (
    <View>
      {items.map((b, i) => {
        if (b.type === 'image') {
          return (
            <Image
              key={`img-${i}-${b.src}`}
              source={{ uri: b.src }}
              style={[styles.image, { width: imageWidth }]}
              resizeMode="cover"
              accessibilityLabel={b.alt || undefined}
            />
          )
        }
        return (
          <Text
            key={`txt-${i}`}
            selectable
            style={[
              styles.paragraph,
              {
                color: theme.text,
                fontSize: fontConfig.bodySize,
                lineHeight: fontConfig.lineHeight,
              },
            ]}
          >
            {b.content}
          </Text>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  paragraph: {
    marginBottom: 16,
  },
  image: {
    height: 220,
    borderRadius: 8,
    marginBottom: 16,
  },
})
