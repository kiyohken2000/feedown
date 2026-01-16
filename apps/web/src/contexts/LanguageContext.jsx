import { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

const STORAGE_KEY = 'feedown_language';

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    // Try to get from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (stored === 'en' || stored === 'ja')) {
      return stored;
    }
    // Detect browser language
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('ja')) {
      return 'ja';
    }
    return 'en';
  });

  const setLanguage = (lang) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export default LanguageContext;
