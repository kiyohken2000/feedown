import { StyleSheet } from "react-native";

export default StyleSheet.create({
  background: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: -1
  },
  blur: {
    flex: 1,
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 1
  },
  bottom: {
    bottom: 0
  },
  top: {
    top: 0
  },
  wrapper: {
    flex: 1,
    position: "relative"
  }
});
