import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { FaCheck, FaSync, FaArrowUp, FaList, FaTh } from 'react-icons/fa';
import { getAccessToken } from '../lib/supabase';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';
import Navigation from '../components/Navigation';
import ArticleModal from '../components/ArticleModal';
import { useTheme } from '../contexts/ThemeContext';
import { useArticles } from '../contexts/ArticlesContext';

const DashboardPage = () => {
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [articlesError, setArticlesError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [selectedFeedId, setSelectedFeedId] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
  const [checkedArticles, setCheckedArticles] = useState(new Set());

  const location = useLocation();
  const { isDarkMode } = useTheme();
  const {
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
  } = useArticles();
  const observerRef = useRef(null);
  const articleRefs = useRef({});
  const loadMoreRef = useRef(null);
  const loadMoreObserverRef = useRef(null);
  const fullyViewedArticles = useRef(new Set());
  const handleRefreshRef = useRef(null);

  const apiClient = useMemo(() => createApiClient(
    import.meta.env.VITE_API_BASE_URL || '',
    getAccessToken
  ), []);

  const api = useMemo(() => new FeedOwnAPI(apiClient), [apiClient]);

  const markAsRead = useCallback(async (articleId) => {
    setReadArticles(prev => new Set([...prev, articleId]));
    try {
      await api.articles.markAsRead(articleId);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }, [api, setReadArticles]);

  const fetchFeeds = useCallback(async () => {
    try {
      const response = await api.feeds.list();
      if (response.success) {
        setFeeds(response.data.feeds || []);
      }
    } catch (error) {
      console.error('Failed to fetch feeds:', error);
    }
  }, [api]);

  const fetchArticles = useCallback(async (reset = true, feedId = null) => {
    if (reset) {
      setArticlesLoading(true);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }
    setArticlesError(null);

    try {
      const currentOffset = reset ? 0 : articles.length;
      const limit = 50;
      const response = await api.articles.list({
        limit,
        offset: currentOffset,
        feedId: feedId || undefined,
      });

      if (response.success) {
        const newArticles = response.data.articles || [];
        const hasMoreData = response.data.hasMore ?? (newArticles.length === limit);

        if (reset) {
          setArticles(newArticles);
        } else {
          setArticles(prev => [...prev, ...newArticles]);
        }

        setHasMore(hasMoreData);

        const readSet = reset ? new Set() : new Set(readArticles);
        newArticles.forEach(article => {
          if (article.isRead) readSet.add(article.id);
        });
        setReadArticles(readSet);

        if (reset) setLastArticleFetchTime(Date.now());
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Failed to fetch articles:', error);
      setArticlesError('Failed to load articles.');
    } finally {
      if (reset) {
        setArticlesLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [api, articles.length]);

  const handleRefresh = useCallback(async () => {
    setArticlesLoading(true);
    try {
      let offset = 0;
      let latestFeeds = null;

      while (true) {
        const refreshResponse = await api.refresh.refreshAll(offset || undefined);
        if (!refreshResponse.success) break;

        const { stats, remaining, nextOffset } = refreshResponse.data;
        if (refreshResponse.data.feeds) latestFeeds = refreshResponse.data.feeds;
        if (!remaining || remaining <= 0 || !nextOffset) break;
        offset = nextOffset;
      }

      if (latestFeeds) {
        setFeeds(latestFeeds);
      } else {
        await fetchFeeds();
      }

      await fetchArticles(true, selectedFeedId);
    } catch (error) {
      console.error('Failed to refresh:', error);
      setArticlesError('Failed to refresh feeds.');
      setArticlesLoading(false);
    }
  }, [api, fetchFeeds, fetchArticles, setFeeds, selectedFeedId]);

  handleRefreshRef.current = handleRefresh;

  useEffect(() => {
    handleRefreshRef.current?.();
  }, [location.key]);

  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (location.pathname === '/dashboard' && prevPathRef.current !== '/dashboard') {
      fetchArticles(true, selectedFeedId);
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname, fetchArticles, selectedFeedId]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchArticles(true, selectedFeedId);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchArticles, selectedFeedId]);

  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (lastArticleFetchTime) {
        const now = Date.now();
        if (now - lastArticleFetchTime >= 15 * 60 * 1000) {
          handleRefreshRef.current?.();
        }
      }
    }, 60 * 1000);
    return () => clearInterval(checkInterval);
  }, [lastArticleFetchTime]);

  const unreadCount = useMemo(() => {
    return articles.filter(article => !readArticles.has(article.id)).length;
  }, [articles, readArticles]);

  useEffect(() => {
    if (filter === 'all') {
      setFilteredArticles(articles);
    } else if (filter === 'unread') {
      setFilteredArticles(articles.filter(article => !readArticles.has(article.id)));
    } else if (filter === 'read') {
      setFilteredArticles(articles.filter(article => readArticles.has(article.id)));
    }
  }, [articles, filter, readArticles]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [filter]);

  const prevFeedIdRef = useRef(selectedFeedId);
  useEffect(() => {
    if (prevFeedIdRef.current !== selectedFeedId) {
      fetchArticles(true, selectedFeedId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    prevFeedIdRef.current = selectedFeedId;
  }, [selectedFeedId, fetchArticles]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    if (filter === 'unread') return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const articleId = entry.target.dataset.articleId;
          if (!articleId || readArticles.has(articleId)) return;

          if (entry.isIntersecting && entry.intersectionRatio >= 1.0) {
            if (!fullyViewedArticles.current.has(articleId)) {
              fullyViewedArticles.current.add(articleId);
            }
          }

          if (entry.isIntersecting && entry.intersectionRatio <= 0.5 && fullyViewedArticles.current.has(articleId)) {
            fullyViewedArticles.current.delete(articleId);
            markAsRead(articleId);
          }

          if (!entry.isIntersecting && fullyViewedArticles.current.has(articleId)) {
            fullyViewedArticles.current.delete(articleId);
            markAsRead(articleId);
          }
        });
      },
      { threshold: [0, 0.5, 1.0] }
    );

    Object.values(articleRefs.current).forEach((ref) => {
      if (ref && observerRef.current) observerRef.current.observe(ref);
    });

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [filteredArticles, readArticles, markAsRead, filter]);

  useEffect(() => {
    if (loadMoreObserverRef.current) loadMoreObserverRef.current.disconnect();

    loadMoreObserverRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loadingMore && !articlesLoading) {
          fetchArticles(false, selectedFeedId);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) loadMoreObserverRef.current.observe(loadMoreRef.current);

    return () => {
      if (loadMoreObserverRef.current) loadMoreObserverRef.current.disconnect();
    };
  }, [hasMore, loadingMore, articlesLoading, selectedFeedId]);

  const handleMarkAllAsRead = async () => {
    if (articlesLoading) return;
    const unreadArticleIds = articles.filter(article => !readArticles.has(article.id)).map(a => a.id);
    if (unreadArticleIds.length === 0) return;

    setReadArticles(prev => {
      const newSet = new Set(prev);
      unreadArticleIds.forEach(id => newSet.add(id));
      return newSet;
    });

    try {
      await api.articles.batchMarkAsRead(unreadArticleIds);
      await fetchArticles(true, selectedFeedId);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      setReadArticles(prev => {
        const newSet = new Set(prev);
        unreadArticleIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  };

  // チェックしたものを既読にする
  const handleMarkCheckedAsRead = async () => {
    if (checkedArticles.size === 0) return;
    const ids = [...checkedArticles];

    setReadArticles(prev => {
      const newSet = new Set(prev);
      ids.forEach(id => newSet.add(id));
      return newSet;
    });
    setCheckedArticles(new Set());

    try {
      await api.articles.batchMarkAsRead(ids);
    } catch (error) {
      console.error('Failed to mark checked as read:', error);
    }
  };

  const handleCheckboxChange = (e, articleId) => {
    e.stopPropagation();
    setCheckedArticles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(articleId)) {
        newSet.delete(articleId);
      } else {
        newSet.add(articleId);
      }
      return newSet;
    });
  };

  const handleArticleClick = (article) => {
    setSelectedArticle(article);
    if (!readArticles.has(article.id)) markAsRead(article.id);
  };

  const handleCloseModal = () => setSelectedArticle(null);
  const handleMarkAsRead = () => {
    if (!selectedArticle) return;
    markAsRead(selectedArticle.id);
  };

  const handleToggleFavorite = async () => {
    if (!selectedArticle) return;
    try {
      if (favoritedArticles.has(selectedArticle.id)) {
        await api.articles.removeFromFavorites(selectedArticle.id);
        setFavoritedArticles(prev => {
          const newSet = new Set(prev);
          newSet.delete(selectedArticle.id);
          return newSet;
        });
      } else {
        await api.articles.addToFavorites(selectedArticle.id, {
          title: selectedArticle.title,
          url: selectedArticle.url,
          description: selectedArticle.description,
          feedTitle: selectedArticle.feedTitle,
          imageUrl: selectedArticle.imageUrl,
        });
        setFavoritedArticles(prev => new Set([...prev, selectedArticle.id]));
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const getRelativeTime = (dateString) => {
    if (!dateString) return 'Unknown date';
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now - date) / 1000);
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const getFeedFavicon = (feedId) => {
    const feed = feeds.find(f => f.id === feedId);
    return feed?.faviconUrl || null;
  };

  const styles = {
    container: {
      paddingLeft: '2rem',
      paddingRight: '2rem',
      paddingBottom: '2rem',
      maxWidth: '1200px',
      margin: '0 auto',
    },
    controlsWrapper: {
      position: 'sticky',
      top: '73px',
      backgroundColor: isDarkMode ? 'rgba(26, 26, 26, 0.85)' : 'rgba(240, 240, 240, 0.85)',
      backdropFilter: 'blur(10px)',
      zIndex: 50,
      borderBottom: isDarkMode ? '1px solid #444' : '1px solid #ddd',
      width: '100%',
    },
    controls: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: '1rem',
      paddingBottom: '1rem',
      paddingLeft: '2rem',
      paddingRight: '2rem',
      flexWrap: 'wrap',
      gap: '1rem',
      maxWidth: '1200px',
      margin: '0 auto',
    },
    buttonGroup: {
      display: 'flex',
      gap: '0.5rem',
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    filterGroup: {
      display: 'flex',
      gap: '0.5rem',
    },
    leftControls: {
      display: 'flex',
      gap: '1rem',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    feedSelector: {
      padding: '0.5rem 1rem',
      border: '2px solid #FF6B35',
      backgroundColor: isDarkMode ? '#2d2d2d' : 'white',
      color: isDarkMode ? '#e0e0e0' : '#333',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: '0.9rem',
      fontWeight: '600',
      minWidth: '150px',
      maxWidth: '250px',
    },
    filterButton: {
      padding: '0.5rem 1rem',
      border: '2px solid #FF6B35',
      backgroundColor: isDarkMode ? '#2d2d2d' : 'white',
      color: '#FF6B35',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: '0.9rem',
      fontWeight: '600',
      transition: 'all 0.3s',
    },
    activeFilter: {
      backgroundColor: '#FF6B35',
      color: 'white',
    },
    refreshButton: {
      padding: '0.5rem 1.5rem',
      backgroundColor: '#FF6B35',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: '0.9rem',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
    },
    markAllReadButton: {
      padding: '0.5rem 1.5rem',
      backgroundColor: '#28a745',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: '0.9rem',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
    },
    markCheckedButton: {
      padding: '0.5rem 1.5rem',
      backgroundColor: checkedArticles.size > 0 ? '#17a2b8' : '#aaa',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      cursor: checkedArticles.size > 0 ? 'pointer' : 'default',
      fontSize: '0.9rem',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
    },
    scrollTopButton: {
      padding: '0.5rem 1.5rem',
      backgroundColor: '#6c757d',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: '0.9rem',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
    },
    viewToggleButton: {
      padding: '0.5rem 1rem',
      backgroundColor: isDarkMode ? '#2d2d2d' : 'white',
      color: isDarkMode ? '#e0e0e0' : '#333',
      border: '2px solid #FF6B35',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: '0.9rem',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
    },
    buttonIcon: { fontSize: '0.85rem' },
    articlesList: {
      display: 'grid',
      gap: viewMode === 'card' ? '1rem' : '0',
    },
    // カード表示
    articleCard: {
      backgroundColor: isDarkMode ? '#2d2d2d' : 'white',
      borderRadius: '8px',
      padding: '1rem',
      boxShadow: isDarkMode ? '0 2px 4px rgba(0,0,0,0.4)' : '0 2px 4px rgba(0,0,0,0.1)',
      cursor: 'pointer',
      transition: 'all 0.3s',
      border: isDarkMode ? '1px solid #444' : '1px solid #eee',
      display: 'flex',
      gap: '1rem',
      alignItems: 'flex-start',
    },
    // リスト表示
    articleListRow: {
      backgroundColor: isDarkMode ? '#2d2d2d' : 'white',
      padding: '0.6rem 1rem',
      cursor: 'pointer',
      transition: 'all 0.2s',
      borderBottom: isDarkMode ? '1px solid #333' : '1px solid #eee',
      display: 'flex',
      gap: '0.75rem',
      alignItems: 'center',
    },
    articleCardRead: { opacity: 0.6 },
    thumbnail: {
      width: '200px',
      height: '120px',
      objectFit: 'cover',
      borderRadius: '6px',
      flexShrink: 0,
    },
    noThumbnail: {
      width: '200px',
      height: '120px',
      borderRadius: '6px',
      flexShrink: 0,
      backgroundColor: isDarkMode ? '#1a1a1a' : '#f0f0f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#999',
      fontSize: '0.8rem',
    },
    articleContent: { flex: 1, minWidth: 0 },
    articleMeta: {
      display: 'flex',
      gap: '0.5rem',
      alignItems: 'center',
      fontSize: '0.85rem',
      color: isDarkMode ? '#b0b0b0' : '#999',
      marginBottom: '0.5rem',
      flexWrap: 'wrap',
    },
    listMeta: {
      display: 'flex',
      gap: '0.5rem',
      alignItems: 'center',
      fontSize: '0.8rem',
      color: isDarkMode ? '#b0b0b0' : '#999',
      flexShrink: 0,
      minWidth: '160px',
    },
    feedTitle: {
      color: '#FF6B35',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      gap: '0.3rem',
    },
    favicon: { width: '16px', height: '16px', borderRadius: '2px', flexShrink: 0 },
    articleTitle: {
      color: isDarkMode ? '#e0e0e0' : '#333',
      marginBottom: '0.5rem',
      fontSize: '1.1rem',
      fontWeight: '600',
      lineHeight: '1.4',
    },
    listTitle: {
      color: isDarkMode ? '#e0e0e0' : '#333',
      fontSize: '0.95rem',
      fontWeight: '500',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      flex: 1,
    },
    articleDescription: {
      color: isDarkMode ? '#b0b0b0' : '#666',
      lineHeight: '1.5',
      fontSize: '0.95rem',
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
    },
    checkbox: {
      width: '18px',
      height: '18px',
      cursor: 'pointer',
      flexShrink: 0,
      accentColor: '#FF6B35',
    },
    noArticles: {
      textAlign: 'center',
      padding: '3rem',
      color: isDarkMode ? '#b0b0b0' : '#999',
    },
    loadingSpinner: {
      border: '4px solid #f3f3f3',
      borderTop: '4px solid #FF6B35',
      borderRadius: '50%',
      width: '40px',
      height: '40px',
      animation: 'spin 1s linear infinite',
      margin: '2rem auto',
    },
    inlineSpinner: {
      border: '3px solid #f3f3f3',
      borderTop: '3px solid #FF6B35',
      borderRadius: '50%',
      width: '20px',
      height: '20px',
      animation: 'spin 1s linear infinite',
      display: 'inline-block',
    },
    loadMoreTrigger: {
      height: '100px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingMore: {
      textAlign: 'center',
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1rem',
    },
    endOfArticles: {
      textAlign: 'center',
      padding: '2rem',
      color: isDarkMode ? '#b0b0b0' : '#999',
      fontSize: '0.9rem',
    },
  };

  return (
    <div>
      <Navigation unreadCount={unreadCount} />
      <div style={styles.controlsWrapper}>
        <div style={styles.controls}>
          <div style={styles.leftControls}>
            <select
              value={selectedFeedId}
              onChange={(e) => setSelectedFeedId(e.target.value)}
              style={styles.feedSelector}
            >
              <option value="">All Feeds</option>
              {feeds.map((feed) => (
                <option key={feed.id} value={feed.id}>
                  {feed.title || feed.url}
                </option>
              ))}
            </select>

            <div style={styles.filterGroup}>
              {['all', 'unread', 'read'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    ...styles.filterButton,
                    ...(filter === f ? styles.activeFilter : {}),
                  }}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.buttonGroup}>
            {/* チェック済みを既読にするボタン */}
            <button
              onClick={handleMarkCheckedAsRead}
              style={styles.markCheckedButton}
              disabled={checkedArticles.size === 0}
              title="チェックした記事を既読にする"
            >
              <FaCheck style={styles.buttonIcon} /> 選択を既読 ({checkedArticles.size})
            </button>

            <button
              onClick={handleMarkAllAsRead}
              style={styles.markAllReadButton}
              disabled={articlesLoading || unreadCount === 0}
            >
              <FaCheck style={styles.buttonIcon} /> Mark All Read
            </button>

            <button
              onClick={handleRefresh}
              style={styles.refreshButton}
              disabled={articlesLoading}
            >
              <FaSync style={styles.buttonIcon} /> Refresh
            </button>

            {/* 表示切替ボタン */}
            <button
              onClick={() => setViewMode(v => v === 'card' ? 'list' : 'card')}
              style={styles.viewToggleButton}
              title="表示形式を切り替え"
            >
              {viewMode === 'card' ? <FaList style={styles.buttonIcon} /> : <FaTh style={styles.buttonIcon} />}
              {viewMode === 'card' ? ' List' : ' Card'}
            </button>

            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              style={styles.scrollTopButton}
            >
              <FaArrowUp style={styles.buttonIcon} /> Top
            </button>

            {articlesLoading && <div style={styles.inlineSpinner}></div>}
          </div>
        </div>
      </div>

      <div style={styles.container}>
        {articlesError && (
          <p style={{ color: 'red', textAlign: 'center' }}>{articlesError}</p>
        )}

        {!articlesError && (
          <div style={styles.articlesList}>
            {filteredArticles.length > 0 ? (
              filteredArticles.map((article) => {
                const isRead = readArticles.has(article.id);
                const isChecked = checkedArticles.has(article.id);

                if (viewMode === 'list') {
                  // リスト表示
                  return (
                    <div
                      key={article.id}
                      ref={(el) => (articleRefs.current[article.id] = el)}
                      data-article-id={article.id}
                      style={{
                        ...styles.articleListRow,
                        ...(isRead ? styles.articleCardRead : {}),
                        backgroundColor: isChecked
                          ? (isDarkMode ? '#3a3a2a' : '#fffbe6')
                          : (isDarkMode ? '#2d2d2d' : 'white'),
                      }}
                      onClick={() => handleArticleClick(article)}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = isDarkMode ? '#383838' : '#f9f9f9';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = isChecked
                          ? (isDarkMode ? '#3a3a2a' : '#fffbe6')
                          : (isDarkMode ? '#2d2d2d' : 'white');
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => handleCheckboxChange(e, article.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={styles.checkbox}
                      />
                      <div style={styles.listMeta}>
                        <span style={styles.feedTitle}>
                          {getFeedFavicon(article.feedId) && (
                            <img
                              src={getFeedFavicon(article.feedId)}
                              alt=""
                              style={styles.favicon}
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          )}
                          {article.feedTitle?.slice(0, 12) || 'Feed'}
                        </span>
                        <span>•</span>
                        <span style={{ fontSize: '0.8rem' }}>{getRelativeTime(article.publishedAt)}</span>
                        {isRead && <span style={{ color: '#28a745', fontSize: '0.75rem' }}>✓</span>}
                      </div>
                      <span style={styles.listTitle}>{article.title}</span>
                    </div>
                  );
                }

                // カード表示
                return (
                  <div
                    key={article.id}
                    ref={(el) => (articleRefs.current[article.id] = el)}
                    data-article-id={article.id}
                    style={{
                      ...styles.articleCard,
                      ...(isRead ? styles.articleCardRead : {}),
                      outline: isChecked ? '2px solid #FF6B35' : 'none',
                    }}
                    onClick={() => handleArticleClick(article)}
                    onMouseOver={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => handleCheckboxChange(e, article.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={styles.checkbox}
                    />
                    {article.imageUrl ? (
                      <img src={article.imageUrl} alt={article.title} style={styles.thumbnail} />
                    ) : (
                      <div style={styles.noThumbnail}>No image</div>
                    )}
                    <div style={styles.articleContent}>
                      <div style={styles.articleMeta}>
                        <span style={styles.feedTitle}>
                          {getFeedFavicon(article.feedId) && (
                            <img
                              src={getFeedFavicon(article.feedId)}
                              alt=""
                              style={styles.favicon}
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          )}
                          {article.feedTitle || 'Unknown Feed'}
                        </span>
                        <span>•</span>
                        <span>{getRelativeTime(article.publishedAt)}</span>
                        {isRead && <span style={{ color: '#28a745' }}>✓ Read</span>}
                      </div>
                      <h3 style={styles.articleTitle}>{article.title}</h3>
                      <p style={styles.articleDescription}>
                        {article.description || 'No description available'}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={styles.noArticles}>
                <p>No articles found.</p>
                <p>Try adding some feeds or changing the filter.</p>
              </div>
            )}

            {filteredArticles.length > 0 && hasMore && (
              <div ref={loadMoreRef} style={styles.loadMoreTrigger}>
                {loadingMore && (
                  <div style={styles.loadingMore}>
                    <div style={styles.loadingSpinner}></div>
                    <p>Loading more articles...</p>
                  </div>
                )}
              </div>
            )}

            {filteredArticles.length > 0 && !hasMore && (
              <div style={styles.endOfArticles}>
                <p>No more articles to load</p>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedArticle && (
        <ArticleModal
          article={selectedArticle}
          onClose={handleCloseModal}
          onMarkAsRead={handleMarkAsRead}
          onToggleFavorite={handleToggleFavorite}
          isRead={readArticles.has(selectedArticle.id)}
          isFavorited={favoritedArticles.has(selectedArticle.id)}
        />
      )}
    </div>
  );
};

export default DashboardPage;
