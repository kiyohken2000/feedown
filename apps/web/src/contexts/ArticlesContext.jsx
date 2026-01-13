import React, { createContext, useState, useContext } from 'react';

const ArticlesContext = createContext();

export const useArticles = () => {
  const context = useContext(ArticlesContext);
  if (!context) {
    throw new Error('useArticles must be used within ArticlesProvider');
  }
  return context;
};

export const ArticlesProvider = ({ children }) => {
  const [articles, setArticles] = useState([]);
  const [readArticles, setReadArticles] = useState(new Set());
  const [favoritedArticles, setFavoritedArticles] = useState(new Set());
  const [feeds, setFeeds] = useState([]);
  const [lastArticleFetchTime, setLastArticleFetchTime] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // Add articles to the existing list (for pagination)
  const addArticles = (newArticles) => {
    setArticles(prev => [...prev, ...newArticles]);
  };

  // Replace all articles (for refresh)
  const replaceArticles = (newArticles) => {
    setArticles(newArticles);
  };

  // Mark an article as read
  const markAsRead = (articleId) => {
    setReadArticles(prev => new Set([...prev, articleId]));
  };

  // Mark multiple articles as read
  const markManyAsRead = (articleIds) => {
    setReadArticles(prev => {
      const newSet = new Set(prev);
      articleIds.forEach(id => newSet.add(id));
      return newSet;
    });
  };

  // Toggle favorite status
  const toggleFavorite = (articleId) => {
    setFavoritedArticles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(articleId)) {
        newSet.delete(articleId);
      } else {
        newSet.add(articleId);
      }
      return newSet;
    });
  };

  // Clear all data (for logout or data reset)
  const clearAllData = () => {
    setArticles([]);
    setReadArticles(new Set());
    setFavoritedArticles(new Set());
    setFeeds([]);
    setLastArticleFetchTime(null);
    setHasMore(true);
  };

  const value = {
    articles,
    setArticles,
    readArticles,
    setReadArticles,
    favoritedArticles,
    setFavoritedArticles,
    feeds,
    setFeeds,
    lastArticleFetchTime,
    setLastArticleFetchTime,
    hasMore,
    setHasMore,
    addArticles,
    replaceArticles,
    markAsRead,
    markManyAsRead,
    toggleFavorite,
    clearAllData,
  };

  return (
    <ArticlesContext.Provider value={value}>
      {children}
    </ArticlesContext.Provider>
  );
};
