import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';
import Navigation from '../components/Navigation';

const ArticleDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [article, setArticle] = useState(location.state?.article || null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isRead, setIsRead] = useState(false);

  const apiClient = useMemo(() => createApiClient(
    import.meta.env.VITE_API_BASE_URL || '',
    async () => auth.currentUser ? auth.currentUser.getIdToken() : null
  ), [auth]);

  const api = useMemo(() => new FeedOwnAPI(apiClient), [apiClient]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        navigate('/');
      } else {
        setUser(currentUser);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth, navigate]);

  const handleMarkAsRead = async () => {
    try {
      const response = await api.articles.markAsRead(id);
      if (response.success) {
        setIsRead(true);
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
      alert('Failed to mark article as read');
    }
  };

  const handleToggleFavorite = async () => {
    try {
      if (isFavorite) {
        const response = await api.articles.removeFromFavorites(id);
        if (response.success) {
          setIsFavorite(false);
        }
      } else {
        const response = await api.articles.addToFavorites(id, {
          title: article.title,
          url: article.url || article.link,
          description: article.description || '',
          feedTitle: article.feedTitle || '',
        });
        if (response.success) {
          setIsFavorite(true);
        }
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      alert('Failed to update favorite status');
    }
  };

  const styles = {
    container: {
      padding: '2rem',
      maxWidth: '900px',
      margin: '2rem auto',
    },
    article: {
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '2rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    },
    title: {
      color: '#333',
      marginBottom: '1rem',
      fontSize: '2rem',
      fontWeight: 'bold',
      lineHeight: '1.3',
    },
    meta: {
      display: 'flex',
      gap: '1rem',
      marginBottom: '1.5rem',
      color: '#666',
      fontSize: '0.9rem',
    },
    description: {
      color: '#555',
      lineHeight: '1.6',
      marginBottom: '2rem',
      fontSize: '1.1rem',
    },
    actions: {
      display: 'flex',
      gap: '1rem',
      marginBottom: '1.5rem',
      flexWrap: 'wrap',
    },
    button: {
      padding: '0.75rem 1.5rem',
      backgroundColor: '#FF6B35',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: '600',
      transition: 'background-color 0.3s',
    },
    secondaryButton: {
      backgroundColor: '#6c757d',
    },
    activeButton: {
      backgroundColor: '#28a745',
    },
    externalLink: {
      display: 'inline-block',
      padding: '0.75rem 1.5rem',
      backgroundColor: '#007bff',
      color: 'white',
      textDecoration: 'none',
      borderRadius: '5px',
      fontSize: '1rem',
      fontWeight: '600',
      transition: 'background-color 0.3s',
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
          <p>Loading article...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div>
        <Navigation />
        <div style={styles.container}>
          <h1>Article Not Found</h1>
          <p>The article you're looking for could not be found.</p>
          <button onClick={() => navigate('/dashboard')} style={styles.button}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation />
      <div style={styles.container}>
        <div style={styles.article}>
          <h1 style={styles.title}>{article.title}</h1>

          <div style={styles.meta}>
            {article.publishedAt && (
              <span>Published: {new Date(article.publishedAt).toLocaleDateString()}</span>
            )}
          </div>

          <div style={styles.actions}>
            <button
              onClick={handleMarkAsRead}
              style={{
                ...styles.button,
                ...(isRead ? styles.activeButton : {}),
              }}
              disabled={isRead}
            >
              {isRead ? '✓ Marked as Read' : 'Mark as Read'}
            </button>

            <button
              onClick={handleToggleFavorite}
              style={{
                ...styles.button,
                ...styles.secondaryButton,
                ...(isFavorite ? styles.activeButton : {}),
              }}
            >
              {isFavorite ? '★ Favorited' : '☆ Add to Favorites'}
            </button>

            <a
              href={article.url || article.link}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.externalLink}
            >
              Read Full Article →
            </a>
          </div>

          <div style={styles.description}>
            {article.description || 'No description available.'}
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            style={{ ...styles.button, ...styles.secondaryButton }}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArticleDetailPage;
