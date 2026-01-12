import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';
import Navigation from '../components/Navigation';
import ArticleModal from '../components/ArticleModal';

const DashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [articles, setArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [articlesError, setArticlesError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [readArticles, setReadArticles] = useState(new Set());
  const [favoritedArticles, setFavoritedArticles] = useState(new Set());

  const navigate = useNavigate();
  const auth = getAuth();
  const observerRef = useRef(null);
  const articleRefs = useRef({});

  const apiClient = useMemo(() => createApiClient(
    import.meta.env.VITE_API_BASE_URL || '/api',
    async () => auth.currentUser ? auth.currentUser.getIdToken() : null
  ), [auth]);

  const api = useMemo(() => new FeedOwnAPI(apiClient), [apiClient]);

  const fetchArticles = async () => {
    setArticlesLoading(true);
    setArticlesError(null);
    try {
      const response = await api.articles.list();
      if (response.success) {
        const articlesList = response.data.articles || [];
        setArticles(articlesList);

        // Build read articles set
        const readSet = new Set();
        articlesList.forEach(article => {
          if (article.isRead) {
            readSet.add(article.id);
          }
        });
        setReadArticles(readSet);
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Failed to fetch articles:', error);
      setArticlesError('Failed to load articles.');
    } finally {
      setArticlesLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        navigate('/');
      } else {
        setUser(currentUser);
        setLoading(false);
        fetchArticles();
      }
    });

    return () => unsubscribe();
  }, [auth, navigate, api]);

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

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const articleId = entry.target.dataset.articleId;
            if (articleId && !readArticles.has(articleId)) {
              // Mark as read after 2 seconds of viewing
              setTimeout(async () => {
                if (entry.target && entry.isIntersecting) {
                  try {
                    await api.articles.markAsRead(articleId);
                    setReadArticles(prev => new Set([...prev, articleId]));
                  } catch (error) {
                    console.error('Failed to mark as read:', error);
                  }
                }
              }, 2000);
            }
          }
        });
      },
      { threshold: 0.5 }
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
  }, [filteredArticles, readArticles, api]);

  const handleRefresh = async () => {
    setArticlesLoading(true);
    try {
      // まずフィードからRSSを取得して記事を保存
      const refreshResponse = await api.refresh.refreshAll();
      if (refreshResponse.success) {
        console.log('Refresh successful:', refreshResponse.data);
      }
      // その後、記事一覧を再取得
      await fetchArticles();
    } catch (error) {
      console.error('Failed to refresh:', error);
      setArticlesError('Failed to refresh feeds.');
      setArticlesLoading(false);
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

  const styles = {
    container: {
      padding: '2rem',
      maxWidth: '1200px',
      margin: '0 auto',
    },
    controls: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '1.5rem',
      marginTop: '2rem',
      flexWrap: 'wrap',
      gap: '1rem',
    },
    filterGroup: {
      display: 'flex',
      gap: '0.5rem',
    },
    filterButton: {
      padding: '0.5rem 1rem',
      border: '2px solid #FF6B35',
      backgroundColor: 'white',
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
    articlesList: {
      display: 'grid',
      gap: '1rem',
    },
    articleCard: {
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '1rem',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      cursor: 'pointer',
      transition: 'all 0.3s',
      border: '1px solid #eee',
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
      backgroundColor: '#f0f0f0',
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
      color: '#999',
      marginBottom: '0.5rem',
      flexWrap: 'wrap',
    },
    feedTitle: {
      color: '#FF6B35',
      fontWeight: '600',
    },
    articleTitle: {
      color: '#333',
      marginBottom: '0.5rem',
      fontSize: '1.2rem',
      fontWeight: '600',
      lineHeight: '1.4',
    },
    articleDescription: {
      color: '#666',
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
      color: '#999',
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
      <div style={styles.container}>
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

          <button
            onClick={handleRefresh}
            style={styles.refreshButton}
            disabled={articlesLoading}
          >
            {articlesLoading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>

        {articlesLoading && (
          <div style={{ textAlign: 'center' }}>
            <div style={styles.loadingSpinner}></div>
            <p>Loading articles...</p>
          </div>
        )}

        {articlesError && (
          <p style={{ color: 'red', textAlign: 'center' }}>{articlesError}</p>
        )}

        {!articlesLoading && !articlesError && (
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
                        <span style={styles.feedTitle}>{article.feedTitle || 'Unknown Feed'}</span>
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
