import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTimes, FaList, FaTh, FaStar, FaRss } from 'react-icons/fa';
import { supabase, getAccessToken } from '../lib/supabase';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';
import Navigation from '../components/Navigation';
import ArticleModal from '../components/ArticleModal';
import { useTheme } from '../contexts/ThemeContext';
import { usePersistedState } from '../hooks/usePersistedState';

const FavoritesPage = () => {
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesError, setFavoritesError] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [feeds, setFeeds] = useState([]);
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();

  // 永続化された設定
  const [viewMode, setViewMode] = usePersistedState('favorites_viewMode', 'list');

  const apiClient = useMemo(() => createApiClient(
    import.meta.env.VITE_API_BASE_URL || '',
    getAccessToken
  ), []);
  const api = useMemo(() => new FeedOwnAPI(apiClient), [apiClient]);

  const fetchFeeds = async () => {
    try {
      const res = await api.feeds.list();
      if (res.success) setFeeds(res.data.feeds || []);
    } catch (e) { console.error(e); }
  };

  const fetchFavorites = async () => {
    setFavoritesLoading(true);
    setFavoritesError(null);
    try {
      const res = await api.favorites.list();
      if (res.success) setFavorites(res.data.favorites || []);
      else throw new Error(res.error);
    } catch (e) {
      setFavoritesError('Failed to load favorites.');
    } finally {
      setFavoritesLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/');
      else { setLoading(false); fetchFeeds(); fetchFavorites(); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate('/');
      else setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleArticleClick = (favorite) => {
    setSelectedArticle({
      id: favorite.articleId,
      title: favorite.title,
      url: favorite.url,
      description: favorite.description,
      feedTitle: favorite.feedTitle || 'Unknown Feed',
      publishedAt: favorite.createdAt,
      imageUrl: favorite.imageUrl || null,
    });
  };

  const handleRemoveFromFavorites = async () => {
    if (!selectedArticle) return;
    try {
      await api.articles.removeFromFavorites(selectedArticle.id);
      setSelectedArticle(null);
      await fetchFavorites();
    } catch (e) { console.error(e); }
  };

  const handleRemoveFavoriteFromList = async (e, articleId) => {
    e.stopPropagation();
    try {
      await api.articles.removeFromFavorites(articleId);
      await fetchFavorites();
    } catch (e) { console.error(e); }
  };

  const getRelativeTime = (d) => {
    if (!d) return '';
    const diff = Math.floor((Date.now() - new Date(d)) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(d).toLocaleDateString();
  };

  const getFeedFavicon = (feedTitle) => feeds.find(f => f.title === feedTitle)?.faviconUrl || null;

  const bg = isDarkMode ? '#1a1a1a' : '#f0f0f0';
  const cardBg = isDarkMode ? '#2d2d2d' : 'white';
  const border = isDarkMode ? '#444' : '#e0e0e0';
  const textPrimary = isDarkMode ? '#e0e0e0' : '#333';
  const textSecondary = isDarkMode ? '#aaa' : '#888';

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: bg }}>
      <Navigation />
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #FF6B35', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: bg }}>
      <Navigation />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 2rem' }}>

        {/* Header + toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FaStar style={{ color: '#FFD700', fontSize: '1.4rem' }} />
            <h1 style={{ color: textPrimary, fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>Favorites</h1>
            <span style={{ backgroundColor: '#FF6B35', color: 'white', borderRadius: '12px', padding: '0.15rem 0.6rem', fontSize: '0.82rem', fontWeight: '700' }}>
              {favorites.length}
            </span>
          </div>

          {/* View toggle */}
          <button
            onClick={() => setViewMode(v => v === 'card' ? 'list' : 'card')}
            style={{
              padding: '0.35rem 0.9rem', border: `1px solid ${border}`, borderRadius: '20px',
              backgroundColor: 'transparent', color: textSecondary,
              cursor: 'pointer', fontSize: '0.85rem',
              display: 'flex', alignItems: 'center', gap: '0.3rem',
            }}
          >
            {viewMode === 'card' ? <><FaList /> List</> : <><FaTh /> Card</>}
          </button>
        </div>

        {favoritesLoading && (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #FF6B35', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        )}
        {favoritesError && <p style={{ color: 'red', textAlign: 'center' }}>{favoritesError}</p>}

        {!favoritesLoading && !favoritesError && favorites.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem', color: textSecondary }}>
            <FaStar style={{ fontSize: '3rem', opacity: 0.2, marginBottom: '1rem' }} />
            <p>No favorite articles yet.</p>
            <p>Star articles from the dashboard to save them here!</p>
          </div>
        )}

        {/* CARD VIEW */}
        {!favoritesLoading && !favoritesError && favorites.length > 0 && viewMode === 'card' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {favorites.map(favorite => (
              <div
                key={favorite.articleId}
                onClick={() => handleArticleClick(favorite)}
                style={{
                  backgroundColor: cardBg, borderRadius: '10px', overflow: 'hidden',
                  boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
                  border: `1px solid ${border}`, cursor: 'pointer', position: 'relative',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)'; }}
              >
                <button
                  onClick={e => handleRemoveFavoriteFromList(e, favorite.articleId)}
                  style={{
                    position: 'absolute', top: '8px', right: '8px', zIndex: 2,
                    backgroundColor: 'rgba(0,0,0,0.5)', color: 'white',
                    border: 'none', borderRadius: '50%', width: '26px', height: '26px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: '0.75rem',
                  }}
                  title="Remove from favorites"
                >
                  <FaTimes />
                </button>
                {favorite.imageUrl ? (
                  <img src={favorite.imageUrl} alt="" style={{ width: '100%', height: '150px', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '60px', backgroundColor: isDarkMode ? '#333' : '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FaRss style={{ color: '#FF6B35', opacity: 0.3, fontSize: '1.2rem' }} />
                  </div>
                )}
                <div style={{ padding: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', fontSize: '0.78rem', color: textSecondary }}>
                    {getFeedFavicon(favorite.feedTitle) && (
                      <img src={getFeedFavicon(favorite.feedTitle)} alt="" style={{ width: '13px', height: '13px', borderRadius: '2px' }} onError={e => e.target.style.display = 'none'} />
                    )}
                    <span style={{ color: '#FF6B35', fontWeight: '600' }}>{favorite.feedTitle || 'Feed'}</span>
                    <span>·</span>
                    <span>{getRelativeTime(favorite.createdAt)}</span>
                  </div>
                  <h3 style={{ color: textPrimary, fontSize: '0.92rem', fontWeight: '600', lineHeight: '1.4', margin: '0 0 0.4rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {favorite.title}
                  </h3>
                  {favorite.description && (
                    <p style={{ color: textSecondary, fontSize: '0.8rem', lineHeight: '1.5', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {favorite.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* LIST VIEW */}
        {!favoritesLoading && !favoritesError && favorites.length > 0 && viewMode === 'list' && (
          <div style={{ backgroundColor: cardBg, borderRadius: '10px', border: `1px solid ${border}`, overflow: 'hidden' }}>
            {favorites.map((favorite, idx) => (
              <div
                key={favorite.articleId}
                onClick={() => handleArticleClick(favorite)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderBottom: idx < favorites.length - 1 ? `1px solid ${border}` : 'none',
                  cursor: 'pointer',
                }}
                onMouseOver={e => { e.currentTarget.style.backgroundColor = isDarkMode ? '#333' : '#f9f9f9'; }}
                onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {favorite.imageUrl ? (
                  <img src={favorite.imageUrl} alt="" style={{ width: '56px', height: '42px', objectFit: 'cover', borderRadius: '5px', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '56px', height: '42px', backgroundColor: isDarkMode ? '#333' : '#f0f0f0', borderRadius: '5px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FaRss style={{ color: '#FF6B35', opacity: 0.3, fontSize: '0.9rem' }} />
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: '130px', maxWidth: '170px', flexShrink: 0 }}>
                  {getFeedFavicon(favorite.feedTitle) && (
                    <img src={getFeedFavicon(favorite.feedTitle)} alt="" style={{ width: '13px', height: '13px', borderRadius: '2px' }} onError={e => e.target.style.display = 'none'} />
                  )}
                  <span style={{ color: '#FF6B35', fontSize: '0.82rem', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {favorite.feedTitle || 'Feed'}
                  </span>
                </div>
                <span style={{ color: textPrimary, fontSize: '0.9rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {favorite.title}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  <span style={{ color: textSecondary, fontSize: '0.8rem' }}>{getRelativeTime(favorite.createdAt)}</span>
                  <button
                    onClick={e => handleRemoveFavoriteFromList(e, favorite.articleId)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: textSecondary, fontSize: '0.8rem', padding: '2px 4px',
                    }}
                    title="Remove from favorites"
                  >
                    <FaTimes />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedArticle && (
        <ArticleModal
          article={selectedArticle}
          onClose={() => setSelectedArticle(null)}
          onMarkAsRead={() => {}}
          onToggleFavorite={handleRemoveFromFavorites}
          isRead={false}
          isFavorited={true}
        />
      )}
    </div>
  );
};

export default FavoritesPage;
