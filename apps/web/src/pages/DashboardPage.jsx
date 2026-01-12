import React, { useEffect, useState, useMemo } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';
import Navigation from '../components/Navigation';

const DashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [articles, setArticles] = useState([]);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [articlesError, setArticlesError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'
  const navigate = useNavigate();
  const auth = getAuth();

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
        setArticles(response.data.articles || []);
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

  // Filter articles based on selected filter
  useEffect(() => {
    if (filter === 'all') {
      setFilteredArticles(articles);
    } else if (filter === 'unread') {
      setFilteredArticles(articles.filter(article => !article.isRead));
    } else if (filter === 'read') {
      setFilteredArticles(articles.filter(article => article.isRead));
    }
  }, [articles, filter]);

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
    navigate(`/article/${article.id}`, { state: { article } });
  };

  const styles = {
    container: {
      padding: '2rem',
      maxWidth: '1000px',
      margin: '2rem auto',
    },
    header: {
      marginBottom: '2rem',
    },
    heading: {
      color: '#333',
      marginBottom: '0.5rem',
      fontSize: '2rem',
      fontWeight: 'bold',
    },
    welcome: {
      color: '#666',
      fontSize: '1rem',
    },
    controls: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '1.5rem',
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
      padding: '1.5rem',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      cursor: 'pointer',
      transition: 'all 0.3s',
      border: '1px solid #eee',
    },
    articleTitle: {
      color: '#333',
      marginBottom: '0.5rem',
      fontSize: '1.3rem',
      fontWeight: '600',
    },
    articleDescription: {
      color: '#666',
      lineHeight: '1.5',
      marginBottom: '0.75rem',
    },
    articleMeta: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '0.85rem',
      color: '#999',
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
        <Navigation />
        <div style={styles.container}>
          <div style={styles.loadingSpinner}></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation />
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.heading}>Dashboard</h1>
          <p style={styles.welcome}>Welcome back, {user?.email}!</p>
        </div>

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
              filteredArticles.map((article) => (
                <div
                  key={article.id}
                  style={styles.articleCard}
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
                  <h3 style={styles.articleTitle}>{article.title}</h3>
                  <p style={styles.articleDescription}>
                    {article.description?.substring(0, 200) || 'No description available'}
                    {article.description?.length > 200 ? '...' : ''}
                  </p>
                  <div style={styles.articleMeta}>
                    <span>
                      {article.publishedAt
                        ? new Date(article.publishedAt).toLocaleDateString()
                        : 'Unknown date'}
                    </span>
                    {article.isRead && <span style={{ color: '#28a745' }}>✓ Read</span>}
                  </div>
                </div>
              ))
            ) : (
              <div style={styles.noArticles}>
                <p>No articles found.</p>
                <p>Try adding some feeds or changing the filter.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
