import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

export default function ArticleTranslatedView({ paragraphs, theme, fontConfig }) {
  return (
    <View>
      {paragraphs.map((text, i) => (
        <Text
          key={i}
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
          {text}
        </Text>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  paragraph: {
    marginBottom: 16,
  },
})
