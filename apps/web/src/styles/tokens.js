// Lightweight design tokens for the web app.
//
// Direction: neutral surfaces, with the brand orange used only as an accent
// (logo, active state, primary buttons). Call getTokens(isDarkMode) to get a
// theme-resolved palette plus a shared radius / shadow scale, then spread the
// values into inline styles.

export const ACCENT = '#FF6B35';
export const ACCENT_HOVER = '#e85d2a';

const light = {
  appBg: '#f6f7f9',
  surface: '#ffffff',
  surface2: '#f1f2f4',
  surfaceHover: '#eceef1',
  border: '#e5e7eb',
  borderStrong: '#d6d9df',
  text: '#17181c',
  textMuted: '#5f636b',
  textFaint: '#9298a1',
  accent: ACCENT,
  accentHover: ACCENT_HOVER,
  accentSoft: 'rgba(255, 107, 53, 0.10)',
  accentBorder: 'rgba(255, 107, 53, 0.35)',
  onAccent: '#ffffff',
  success: '#1f9d55',
  successSoft: 'rgba(31, 157, 85, 0.12)',
  danger: '#dc3545',
  overlay: 'rgba(17, 19, 24, 0.45)',
  controlsBg: 'rgba(246, 247, 249, 0.8)',
};

const dark = {
  appBg: '#111214',
  surface: '#1b1c20',
  surface2: '#25272c',
  surfaceHover: '#2c2e34',
  border: '#2c2e34',
  borderStrong: '#3a3d45',
  text: '#e9eaed',
  textMuted: '#a2a7b0',
  textFaint: '#71767f',
  accent: ACCENT,
  accentHover: ACCENT_HOVER,
  accentSoft: 'rgba(255, 107, 53, 0.16)',
  accentBorder: 'rgba(255, 107, 53, 0.45)',
  onAccent: '#ffffff',
  success: '#3ec877',
  successSoft: 'rgba(62, 200, 119, 0.16)',
  danger: '#f0616f',
  overlay: 'rgba(0, 0, 0, 0.6)',
  controlsBg: 'rgba(17, 18, 20, 0.8)',
};

const radius = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  pill: '999px',
};

const shadowLight = {
  sm: '0 1px 2px rgba(16, 18, 26, 0.06)',
  md: '0 2px 10px rgba(16, 18, 26, 0.09)',
  lg: '0 10px 34px rgba(16, 18, 26, 0.14)',
};

const shadowDark = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
  md: '0 4px 16px rgba(0, 0, 0, 0.45)',
  lg: '0 14px 42px rgba(0, 0, 0, 0.55)',
};

export function getTokens(isDarkMode) {
  return {
    color: isDarkMode ? dark : light,
    radius,
    shadow: isDarkMode ? shadowDark : shadowLight,
    isDarkMode,
  };
}
