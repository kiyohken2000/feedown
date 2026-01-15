import { View } from "react-native";
import React from "react";

// Simplified BlurBox for Expo Go compatibility
// Original Skia-based blur effects are disabled
const BlurBox = ({ children, style }) => {
  return (
    <View style={[{ flex: 1 }, style]}>
      {children}
    </View>
  );
};

export default BlurBox;
