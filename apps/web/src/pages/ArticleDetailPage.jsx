import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { LuCheck, LuStar, LuExternalLink, LuArrowLeft } from 'react-icons/lu';
import { supabase, getAccessToken } from '../lib/supabase';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';
import Navigation from '../components/Navigation';
import { useTheme } from '../contexts/ThemeContext';
import { getTokens } from '../styles/tokens';

const ArticleDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode } = useTheme();
  const { color, radius, shadow } = getTokens(isDarkMode);

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [article, setArticle] = useState(location.state?.article || null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isRead, setIsRead] = useState(false);

  const apiClient = useMemo(() => createApiClient(
    import.meta.env.VITE_API_BASE_URL || '',
    getAccessToken
  ), []);

  const api = useMemo(() => new FeedOwnAPI(apiClient), [apiClient]);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/');
      } else {
        setUser(session.user);
        setLoading(false);
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

  const buttonBase = {
    padding: '0.7rem 1.35rem',
    border: 'none',
    borderRadius: radius.sm,
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 600,
    transition: 'all 0.2s',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
  };

  const styles = {
    container: {
      padding: '2rem',
      maxWidth: '820px',
      margin: '1.5rem auto',
    },
    article: {
      backgroundColor: color.surface,
      borderRadius: radius.lg,
      padding: '2rem',
      border: `1px solid ${color.border}`,
      boxShadow: shadow.sm,
    },
    title: {
      color: color.text,
      marginBottom: '1rem',
      fontSize: '2rem',
      fontWeight: 800,
      letterSpacing: '-0.02em',
      lineHeight: '1.25',
    },
    meta: {
      display: 'flex',
      gap: '1rem',
      marginBottom: '1.5rem',
      color: color.textFaint,
      fontSize: '0.9rem',
    },
    description: {
      color: color.textMuted,
      lineHeight: '1.7',
      marginBottom: '2rem',
      fontSize: '1.1rem',
      whiteSpace: 'pre-wrap',
    },
    actions: {
      display: 'flex',
      gap: '0.6rem',
      marginBottom: '1.5rem',
      flexWrap: 'wrap',
    },
    primaryButton: {
      ...buttonBase,
      backgroundColor: color.surface2,
      color: color.text,
    },
    favoriteButton: {
      ...buttonBase,
      backgroundColor: color.surface2,
      color: color.text,
    },
    favoriteButtonActive: {
      backgroundColor: color.accentSoft,
      color: color.accent,
    },
    externalLink: {
      ...buttonBase,
      backgroundColor: color.accent,
      color: color.onAccent,
      textDecoration: 'none',
      boxShadow: shadow.sm,
    },
    backButton: {
      ...buttonBase,
      backgroundColor: color.surface,
      color: color.text,
      border: `1px solid ${color.border}`,
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
          <button onClick={() => navigate('/dashboard')} style={styles.backButton}>
            <LuArrowLeft /> Back to Dashboard
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
              style={styles.primaryButton}
              disabled={isRead}
            >
              <LuCheck /> {isRead ? 'Marked as Read' : 'Mark as Read'}
            </button>

            <button
              onClick={handleToggleFavorite}
              style={{
                ...styles.favoriteButton,
                ...(isFavorite ? styles.favoriteButtonActive : {}),
              }}
            >
              <LuStar fill={isFavorite ? 'currentColor' : 'none'} />
              {isFavorite ? 'Favorited' : 'Add to Favorites'}
            </button>

            <a
              href={article.url || article.link}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.externalLink}
            >
              <LuExternalLink /> Read Full Article
            </a>
          </div>

          <div style={styles.description}>
            {article.description || 'No description available.'}
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            style={styles.backButton}
          >
            <LuArrowLeft /> Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArticleDetailPage;
