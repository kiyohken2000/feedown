const colors = {
  // FeedOwn primary colors
  primary: '#FF6B35',
  primaryDark: '#E55A25',
  grayLight: '#f0f0f0',
  // Original colors
  darkPurple: '#231d54',
  purple: '#8100ff',
  lightPurple: '#9388db',
  lightGrayPurple: '#f7f7fb',
  pink: '#ff3d69',
  gray: '#797777',
  black: '#000000',
  white: '#ffffff',
  bluePrimary: '#006EE7',
  blueSecondary: '#024895',
  yellowPrimary: '#FFFF00',
  yellowSecondary: '#F8DC00',
  grayPrimary: '#6E6E6E',
  graySecondary: '#959595',
  grayThird: '#A6A6A6',
  grayFourth: '#B2B2B2',
  grayFifth: '#E5E5E5',
  graySixth: '#F2F2F2',
  redPrimary: '#FF0000',
  redSecondary: '#FF4444',
  loadingSpinnerColor: 'rgba(0,0,0,0.5)',
}

// Light theme colors
const lightTheme = {
  background: '#f5f5f5',
  surface: '#ffffff',
  text: '#333333',
  textSecondary: '#666666',
  textMuted: '#999999',
  border: '#e0e0e0',
  card: '#ffffff',
  cardBorder: '#e0e0e0',
  inputBackground: '#ffffff',
  inputBorder: '#e0e0e0',
  headerBackground: '#ffffff',
  tabBarBackground: '#ffffff',
  tabBarBorder: '#e0e0e0',
}

// Dark theme colors
const darkTheme = {
  background: '#121212',
  surface: '#1e1e1e',
  text: '#e0e0e0',
  textSecondary: '#b0b0b0',
  textMuted: '#808080',
  border: '#333333',
  card: '#2d2d2d',
  cardBorder: '#444444',
  inputBackground: '#1a1a1a',
  inputBorder: '#444444',
  headerBackground: '#1e1e1e',
  tabBarBackground: '#1e1e1e',
  tabBarBorder: '#333333',
}

// Helper function to get theme colors
const getThemeColors = (isDarkMode) => {
  return isDarkMode ? darkTheme : lightTheme
}

export { colors, lightTheme, darkTheme, getThemeColors }
