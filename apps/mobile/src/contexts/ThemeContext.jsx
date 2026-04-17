import React, { createContext, useState, useEffect, useContext } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

// themeMode: 'light' | 'dark' | 'system'
export const ThemeProvider = ({ children }) => {
  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('themeMode') || 'system';
  });

  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // システムのダークモード変化を監視
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // 実際のダークモード状態
  const isDarkMode =
    themeMode === 'dark' ? true :
    themeMode === 'light' ? false :
    systemDark; // 'system'

  useEffect(() => {
    localStorage.setItem('themeMode', themeMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  }, [themeMode, isDarkMode]);

  const toggleDarkMode = () => {
    // 後方互換性のため残す（light ↔ dark トグル）
    setThemeMode(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const setTheme = (mode) => {
    // 'light' | 'dark' | 'system'
    setThemeMode(mode);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, themeMode, toggleDarkMode, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
