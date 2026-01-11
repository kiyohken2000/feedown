import { Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

export const SIZES = {
  HOME: {
    HEADER: 60
  },
  WINDOW: {
    HEIGHT: height,
    WIDTH: width
  }
};

export const COLORS = {
  bg1: "#F7F7F7",

  bg2: "#F3F2F7",
  bg3: "#FFFFFF",

  bg4: "#f2f2f2",
  black: "#24252C",
  blue: "#688EE0",
  blueGray: "#D1D4DA",

  danger: "#FE3360",
  dangerLight: "#FE336070",
  gray1: "#8E8E93",
  gray2: "#B6B6BB",
  gray3: "#F1F1F1",
  gray4: "#8496AF",

  gray5: "#F3F5F7",
  grayLine: "#E9E9E9",
  green: "#25C35A",
  main: "#5F33E1",

  mainLight: "#5F33E1",
  success: "#14C747",
  successLight: "#E8FAED",

  transparent: "transparent",

  white: "#FFFFFF"
};
