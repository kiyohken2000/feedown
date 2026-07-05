import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuX, LuStar } from 'react-icons/lu';
import { supabase, getAccessToken } from '../lib/supabase';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';
import Navigation from '../components/Navigation';
import ArticleModal from '../components/ArticleModal';
import ReadingDrawer from '../components/ReadingDrawer';
import { useTheme } from '../contexts/ThemeContext';
import { getTokens } from '../styles/tokens';

const FavoritesPage = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesError, setFavoritesError] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [feeds, setFeeds] = useState([]);
  const [isWide, setIsWide] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true
  );
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();

  const apiClient = useMemo(() => createApiClient(
    import.meta.env.VITE_API_BASE_URL || '',
    getAccessToken
  ), []);

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
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/');
      } else {
        setUser(session.user);
        setLoading(false);
        fetchFeeds();
        fetchFavorites();
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/');
      } else {
        setUser(session.user);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Track viewport width to switch between drawer (wide) and modal (narrow)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e) => setIsWide(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const handleArticleClick = (favorite) => {
    // Convert favorite format to article format for modal
    const article = {
      id: favorite.articleId,
      title: favorite.title,
      url: favorite.url,
      description: favorite.description,
      feedTitle: favorite.feedTitle || 'Unknown Feed',
      publishedAt: favorite.createdAt,
      imageUrl: favorite.imageUrl || null,
    };
    setSelectedArticle(article);
  };

  const handleCloseModal = () => {
    setSelectedArticle(null);
  };

  const handleRemoveFromFavorites = async () => {
    if (!selectedArticle) return;

    try {
      await api.articles.removeFromFavorites(selectedArticle.id);
      setSelectedArticle(null);
      // Refresh favorites list
      await fetchFavorites();
    } catch (error) {
      console.error('Failed to remove from favorites:', error);
    }
  };

  const handleRemoveFavoriteFromList = async (e, articleId) => {
    e.stopPropagation(); // Prevent card click
    try {
      await api.articles.removeFromFavorites(articleId);
      await fetchFavorites();
    } catch (error) {
      console.error('Failed to remove from favorites:', error);
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

  const getFeedFavicon = (feedTitle) => {
    const feed = feeds.find(f => f.title === feedTitle);
    return feed?.faviconUrl || null;
  };

  const { color, radius, shadow } = getTokens(isDarkMode);

  const styles = {
    container: {
      paddingLeft: '2rem',
      paddingRight: '2rem',
      paddingBottom: '2rem',
      maxWidth: '1200px',
      margin: '0 auto',
    },
    header: {
      paddingTop: '2rem',
      paddingBottom: '1.5rem',
    },
    heading: {
      color: color.text,
      marginBottom: '0.4rem',
      fontSize: '1.6rem',
      fontWeight: 800,
      letterSpacing: '-0.02em',
      display: 'flex',
      alignItems: 'center',
      gap: '0.6rem',
    },
    favoriteIcon: {
      color: color.accent,
      fontSize: '1.5rem',
    },
    subtitle: {
      color: color.textMuted,
      fontSize: '1rem',
    },
    articlesList: {
      display: 'grid',
      gap: '0.85rem',
    },
    articleCard: {
      backgroundColor: color.surface,
      borderRadius: radius.md,
      padding: '1.25rem',
      boxShadow: shadow.sm,
      border: `1px solid ${color.border}`,
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: 'pointer',
      display: 'flex',
      gap: '1.25rem',
      position: 'relative',
    },
    removeButton: {
      position: 'absolute',
      top: '0.75rem',
      right: '0.75rem',
      backgroundColor: color.surface2,
      color: color.textMuted,
      border: 'none',
      borderRadius: '50%',
      width: '30px',
      height: '30px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s',
      fontSize: '0.85rem',
    },
    articleImage: {
      width: '200px',
      height: '120px',
      objectFit: 'cover',
      borderRadius: radius.sm,
      backgroundColor: color.surface2,
      flexShrink: 0,
    },
    noImage: {
      width: '200px',
      height: '120px',
      backgroundColor: color.surface2,
      borderRadius: radius.sm,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: color.textFaint,
      fontSize: '0.9rem',
      flexShrink: 0,
    },
    articleContent: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.4rem',
    },
    articleMeta: {
      display: 'flex',
      gap: '0.5rem',
      fontSize: '0.82rem',
      color: color.textFaint,
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    feedTitle: {
      color: color.accent,
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
    },
    favicon: {
      width: '16px',
      height: '16px',
      borderRadius: '3px',
      flexShrink: 0,
    },
    articleTitle: {
      color: color.text,
      fontSize: '1.15rem',
      fontWeight: 700,
      lineHeight: '1.35',
      letterSpacing: '-0.01em',
    },
    articleDescription: {
      color: color.textMuted,
      fontSize: '0.95rem',
      lineHeight: '1.6',
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
    },
    noFavorites: {
      textAlign: 'center',
      padding: '3rem',
      color: color.textMuted,
    },
    loadingSpinner: {
      border: `4px solid ${color.surface2}`,
      borderTop: `4px solid ${color.accent}`,
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
          <p style={{ textAlign: 'center' }}>Loading favorites...</p>
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
            <LuStar style={styles.favoriteIcon} fill="currentColor" />
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
          <p style={{ color: color.danger, textAlign: 'center' }}>{favoritesError}</p>
        )}

        {!favoritesLoading && !favoritesError && (
          <div style={styles.articlesList}>
            {favorites.length > 0 ? (
              favorites.map((favorite) => (
                <div
                  key={favorite.articleId}
                  style={styles.articleCard}
                  onClick={() => handleArticleClick(favorite)}
                  onMouseOver={(e) => {
                    e.currentTarget.style.boxShadow = shadow.md;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.boxShadow = shadow.sm;
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <button
                    style={styles.removeButton}
                    onClick={(e) => handleRemoveFavoriteFromList(e, favorite.articleId)}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = color.danger;
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = color.surface2;
                      e.currentTarget.style.color = color.textMuted;
                    }}
                    title="Remove from favorites"
                  >
                    <LuX />
                  </button>
                  {favorite.imageUrl ? (
                    <img
                      src={favorite.imageUrl}
                      alt={favorite.title}
                      style={styles.articleImage}
                    />
                  ) : (
                    <div style={styles.noImage}>No image</div>
                  )}
                  <div style={styles.articleContent}>
                    <div style={styles.articleMeta}>
                      <span style={styles.feedTitle}>
                        {getFeedFavicon(favorite.feedTitle) && (
                          <img
                            src={getFeedFavicon(favorite.feedTitle)}
                            alt=""
                            style={styles.favicon}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        )}
                        {favorite.feedTitle || 'Unknown Feed'}
                      </span>
                      <span>•</span>
                      <span>{getRelativeTime(favorite.createdAt)}</span>
                    </div>
                    <h3 style={styles.articleTitle}>{favorite.title}</h3>
                    <p style={styles.articleDescription}>
                      {favorite.description || 'No description available'}
                    </p>
                  </div>
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

      {selectedArticle && isWide && (
        <ReadingDrawer
          article={selectedArticle}
          onClose={handleCloseModal}
          onMarkAsRead={() => {}} // Favorites don't need mark as read
          onToggleFavorite={handleRemoveFromFavorites}
          isRead={false}
          isFavorited={true}
        />
      )}

      {selectedArticle && !isWide && (
        <ArticleModal
          article={selectedArticle}
          onClose={handleCloseModal}
          onMarkAsRead={() => {}} // Favorites don't need mark as read
          onToggleFavorite={handleRemoveFromFavorites}
          isRead={false}
          isFavorited={true}
        />
      )}
    </div>
  );
};

export default FavoritesPage;
