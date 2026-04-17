import { useState } from 'react';

/**
 * localStorageに値を永続化するuseStateの代替フック
 * @param {string} key - localStorage key
 * @param {*} defaultValue - デフォルト値
 */
export const usePersistedState = (key, defaultValue) => {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved !== null ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setPersistedState = (value) => {
    const next = typeof value === 'function' ? value(state) : value;
    setState(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  };

  return [state, setPersistedState];
};
