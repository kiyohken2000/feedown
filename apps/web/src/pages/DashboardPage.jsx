import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';
import Navigation from '../components/Navigation';
import ArticleModal from '../components/ArticleModal';
import { useTheme } from '../contexts/ThemeContext';
import { useArticles } from '../contexts/ArticlesContext';

const DashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [articlesError, setArticlesError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const navigate = useNavigate();
  const auth = getAuth();
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
  const viewedArticles = useRef(new Set());

  const apiClient = useMemo(() => createApiClient(
    import.meta.env.VITE_API_BASE_URL || '',
    async () => auth.currentUser ? auth.currentUser.getIdToken() : null
  ), [auth]);

  const api = useMemo(() => new FeedOwnAPI(apiClient), [apiClient]);

  const fetchFeeds = async () => {
    try {
      const response = await api.feeds.list();
      if (response.success) {
        setFeeds(response.data.feeds || []);
      }
    } catch (error) {
      console.error('Failed to fetch feeds:', error);
    }
  };

  const fetchArticles = async (reset = true) => {
    if (reset) {
      setArticlesLoading(true);
      // Don't clear articles to keep them visible during refresh
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
        offset: currentOffset
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

        // Build read articles set (merge with existing for incremental load)
        const readSet = reset ? new Set() : new Set(readArticles);
        newArticles.forEach(article => {
          if (article.isRead) {
            readSet.add(article.id);
          }
        });
        setReadArticles(readSet);

        // Update last fetch time only on reset (not for pagination)
        if (reset) {
          setLastArticleFetchTime(Date.now());
        }
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
  };

  const handleRefresh = async () => {
    // Set loading state immediately for better UX
    setArticlesLoading(true);
    try {
      // まずフィードからRSSを取得して記事を保存
      const refreshResponse = await api.refresh.refreshAll();
      if (refreshResponse.success) {
        console.log('Refresh successful:', refreshResponse.data);
      }
      // その後、フィードと記事一覧を再取得
      await fetchFeeds();
      await fetchArticles(true); // reset=true for full reload
    } catch (error) {
      console.error('Failed to refresh:', error);
      setArticlesError('Failed to refresh feeds.');
      setArticlesLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate('/');
      } else {
        setUser(currentUser);
        setLoading(false);
        // Auto-refresh on initial load
        await handleRefresh();
      }
    });

    return () => unsubscribe();
  }, [auth, navigate, api]);

  // Auto-refresh every 1 minute if 10 minutes have passed since last fetch
  useEffect(() => {
    if (!user) return;

    const checkInterval = setInterval(() => {
      if (lastArticleFetchTime) {
        const now = Date.now();
        const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds

        if (now - lastArticleFetchTime >= tenMinutes) {
          console.log('Auto-refreshing articles (10 minutes elapsed)');
          fetchArticles(true);
        }
      }
    }, 60 * 1000); // Check every 1 minute

    return () => clearInterval(checkInterval);
  }, [user, lastArticleFetchTime]);

  // Calculate unread count
  const unreadCount = useMemo(() => {
    return articles.filter(article => !readArticles.has(article.id)).length;
  }, [articles, readArticles]);

  // Filter articles based on selected filter
  useEffect(() => {
    if (filter === 'all') {
      setFilteredArticles(articles);
    } else if (filter === 'unread') {
      setFilteredArticles(articles.filter(article => !readArticles.has(article.id)));
    } else if (filter === 'read') {
      setFilteredArticles(articles.filter(article => readArticles.has(article.id)));
    }
  }, [articles, filter, readArticles]);

  // Setup Intersection Observer for auto-mark-as-read
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Disable auto-mark-as-read when viewing Unread filter
    if (filter === 'unread') {
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const articleId = entry.target.dataset.articleId;
          if (!articleId || readArticles.has(articleId)) return;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            // Article entered viewport - mark as "viewed" immediately
            if (!viewedArticles.current.has(articleId)) {
              viewedArticles.current.add(articleId);
              console.log('Article viewed:', articleId);
            }
          } else if (!entry.isIntersecting && viewedArticles.current.has(articleId)) {
            // Article left viewport and was viewed - mark as read immediately
            console.log('Article scrolled past, marking as read:', articleId);
            viewedArticles.current.delete(articleId);

            api.articles.markAsRead(articleId)
              .then(() => {
                setReadArticles(prev => new Set([...prev, articleId]));
              })
              .catch(error => {
                console.error('Failed to mark as read:', error);
              });
          }
        });
      },
      { threshold: [0, 0.5] } // Trigger at 0% (leaving) and 50% (entering)
    );

    // Observe all article cards
    Object.values(articleRefs.current).forEach((ref) => {
      if (ref && observerRef.current) {
        observerRef.current.observe(ref);
      }
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [filteredArticles, readArticles, api, filter]);

  // Setup Intersection Observer for infinite scroll
  useEffect(() => {
    if (loadMoreObserverRef.current) {
      loadMoreObserverRef.current.disconnect();
    }

    loadMoreObserverRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loadingMore && !articlesLoading) {
          fetchArticles(false);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      loadMoreObserverRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (loadMoreObserverRef.current) {
        loadMoreObserverRef.current.disconnect();
      }
    };
  }, [hasMore, loadingMore, articlesLoading]);

  const handleMarkAllAsRead = async () => {
    if (articlesLoading) return;

    const unreadArticleIds = articles.filter(article => !readArticles.has(article.id)).map(a => a.id);
    if (unreadArticleIds.length === 0) {
      return;
    }

    // Optimistically update UI
    setReadArticles(prev => {
      const newSet = new Set(prev);
      unreadArticleIds.forEach(id => newSet.add(id));
      return newSet;
    });

    // Mark all as read in background
    try {
      await Promise.all(
        unreadArticleIds.map(articleId => api.articles.markAsRead(articleId))
      );
      // Refresh articles after marking all as read
      await fetchArticles(true);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      // Rollback on error
      setReadArticles(prev => {
        const newSet = new Set(prev);
        unreadArticleIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  };

  const handleArticleClick = (article) => {
    setSelectedArticle(article);
  };

  const handleCloseModal = () => {
    setSelectedArticle(null);
  };

  const handleMarkAsRead = async () => {
    if (!selectedArticle) return;

    try {
      await api.articles.markAsRead(selectedArticle.id);
      setReadArticles(prev => new Set([...prev, selectedArticle.id]));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
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
        await api.articles.addToFavorites(
          selectedArticle.id,
          {
            title: selectedArticle.title,
            url: selectedArticle.url,
            description: selectedArticle.description,
            feedTitle: selectedArticle.feedTitle,
            imageUrl: selectedArticle.imageUrl,
          }
        );
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

    if (diffInSeconds < 60) {
      return 'just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString();
    }
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
    },
    filterGroup: {
      display: 'flex',
      gap: '0.5rem',
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
      transition: 'background-color 0.3s',
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
      transition: 'background-color 0.3s',
    },
    articlesList: {
      display: 'grid',
      gap: '1rem',
    },
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
    },
    articleCardRead: {
      opacity: 0.6,
    },
    thumbnail: {
      width: '200px',
      height: '120px',
      objectFit: 'cover',
      borderRadius: '6px',
      flexShrink: 0,
      backgroundColor: '#f0f0f0',
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
    articleContent: {
      flex: 1,
      minWidth: 0,
    },
    articleMeta: {
      display: 'flex',
      gap: '0.5rem',
      alignItems: 'center',
      fontSize: '0.85rem',
      color: isDarkMode ? '#b0b0b0' : '#999',
      marginBottom: '0.5rem',
      flexWrap: 'wrap',
    },
    feedTitle: {
      color: '#FF6B35',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    favicon: {
      width: '16px',
      height: '16px',
      borderRadius: '2px',
      flexShrink: 0,
    },
    articleTitle: {
      color: isDarkMode ? '#e0e0e0' : '#333',
      marginBottom: '0.5rem',
      fontSize: '1.2rem',
      fontWeight: '600',
      lineHeight: '1.4',
    },
    articleDescription: {
      color: isDarkMode ? '#b0b0b0' : '#666',
      lineHeight: '1.5',
      fontSize: '0.95rem',
      marginBottom: '0.5rem',
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
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
      marginLeft: '0.5rem',
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

  if (loading) {
    return (
      <div>
        <Navigation unreadCount={0} />
        <div style={styles.container}>
          <div style={styles.loadingSpinner}></div>
          <p style={{ textAlign: 'center' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation unreadCount={unreadCount} />
      <div style={styles.controlsWrapper}>
        <div style={styles.controls}>
          <div style={styles.filterGroup}>
            <button
              onClick={() => setFilter('all')}
              style={{
                ...styles.filterButton,
                ...(filter === 'all' ? styles.activeFilter : {}),
              }}
            >
              All
            </button>
            <button
              onClick={() => setFilter('unread')}
              style={{
                ...styles.filterButton,
                ...(filter === 'unread' ? styles.activeFilter : {}),
              }}
            >
              Unread
            </button>
            <button
              onClick={() => setFilter('read')}
              style={{
                ...styles.filterButton,
                ...(filter === 'read' ? styles.activeFilter : {}),
              }}
            >
              Read
            </button>
          </div>

          <div style={styles.buttonGroup}>
            <button
              onClick={handleMarkAllAsRead}
              style={styles.markAllReadButton}
              disabled={articlesLoading || unreadCount === 0}
            >
              ✓ Mark All Read
            </button>
            <button
              onClick={handleRefresh}
              style={styles.refreshButton}
              disabled={articlesLoading}
            >
              🔄 Refresh
            </button>
            {articlesLoading && (
              <div style={styles.inlineSpinner}></div>
            )}
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
                return (
                  <div
                    key={article.id}
                    ref={(el) => (articleRefs.current[article.id] = el)}
                    data-article-id={article.id}
                    style={{
                      ...styles.articleCard,
                      ...(isRead ? styles.articleCardRead : {}),
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

            {/* Load more trigger for infinite scroll */}
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

            {/* End of articles indicator */}
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
