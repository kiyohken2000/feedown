import React, { useEffect, useState, useMemo } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';
import Navigation from '../components/Navigation';

const FavoritesPage = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesError, setFavoritesError] = useState(null);
  const navigate = useNavigate();
  const auth = getAuth();

  const apiClient = useMemo(() => createApiClient(
    import.meta.env.VITE_API_BASE_URL || '/api',
    async () => auth.currentUser ? auth.currentUser.getIdToken() : null
  ), [auth]);

  const api = useMemo(() => new FeedOwnAPI(apiClient), [apiClient]);

  const fetchFavorites = async () => {
    setFavoritesLoading(true);
    setFavoritesError(null);
    try {
      const response = await api.favorites.list();
      if (response.success) {
        setFavorites(response.data.favorites || []);
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Failed to fetch favorites:', error);
      setFavoritesError('Failed to load favorites.');
    } finally {
      setFavoritesLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        navigate('/');
      } else {
        setUser(currentUser);
        setLoading(false);
        fetchFavorites();
      }
    });

    return () => unsubscribe();
  }, [auth, navigate, api]);

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
    subtitle: {
      color: '#666',
      fontSize: '1rem',
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
      border: '1px solid #eee',
      transition: 'all 0.3s',
      cursor: 'pointer',
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
    articleLink: {
      color: '#FF6B35',
      textDecoration: 'none',
      fontWeight: '600',
      transition: 'color 0.3s',
    },
    favoriteIcon: {
      color: '#FFD700',
      marginRight: '0.5rem',
    },
    noFavorites: {
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
          <p>Loading favorites...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation />
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.heading}>
            <span style={styles.favoriteIcon}>★</span>
            Favorites
          </h1>
          <p style={styles.subtitle}>Your saved articles ({favorites.length})</p>
        </div>

        {favoritesLoading && (
          <div style={{ textAlign: 'center' }}>
            <div style={styles.loadingSpinner}></div>
            <p>Loading favorites...</p>
          </div>
        )}

        {favoritesError && (
          <p style={{ color: 'red', textAlign: 'center' }}>{favoritesError}</p>
        )}

        {!favoritesLoading && !favoritesError && (
          <div style={styles.articlesList}>
            {favorites.length > 0 ? (
              favorites.map((favorite) => (
                <div
                  key={favorite.articleId}
                  style={styles.articleCard}
                  onMouseOver={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <h3 style={styles.articleTitle}>{favorite.articleTitle}</h3>
                  <p style={styles.articleDescription}>
                    {favorite.articleDescription?.substring(0, 200) || 'No description available'}
                    {favorite.articleDescription?.length > 200 ? '...' : ''}
                  </p>
                  <a
                    href={favorite.articleLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.articleLink}
                    onMouseOver={(e) => (e.target.style.color = '#e55a2b')}
                    onMouseOut={(e) => (e.target.style.color = '#FF6B35')}
                  >
                    Read Full Article →
                  </a>
                </div>
              ))
            ) : (
              <div style={styles.noFavorites}>
                <p>No favorite articles yet.</p>
                <p>Star articles from the dashboard to save them here!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritesPage;
