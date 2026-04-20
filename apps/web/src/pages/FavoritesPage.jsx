import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTimes, FaList, FaTh, FaStar, FaRss, FaNewspaper } from 'react-icons/fa';
import { supabase, getAccessToken } from '../lib/supabase';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';
import Navigation from '../components/Navigation';
import ArticleModal from '../components/ArticleModal';
import { useTheme } from '../contexts/ThemeContext';
import { usePersistedState } from '../hooks/usePersistedState';

// ★ 移管完了したら false に変更
const SHOW_IMPORT_FORM = true;

const FavoritesPage = () => {
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesError, setFavoritesError] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [feeds, setFeeds] = useState([]);
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const [viewMode, setViewMode] = usePersistedState('favorites_viewMode', 'list');

  const [importForm, setImportForm] = useState({ title: '', url: '', feedTitle: '' });
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);

  const apiClient = useMemo(
    () => createApiClient(import.meta.env.VITE_API_BASE_URL || '', getAccessToken),
    []
  );
  const api = useMemo(() => new FeedOwnAPI(apiClient), [apiClient]);

  const bg = isDarkMode ? '#1a1a1a' : '#f0f0f0';
  const cardBg = isDarkMode ? '#2d2d2d' : 'white';
  const border = isDarkMode ? '#444' : '#e0e0e0';
  const textPrimary = isDarkMode ? '#e0e0e0' : '#333';
  const textSecondary = isDarkMode ? '#aaa' : '#888';

  const fetchFeeds = async () => {
    try {
      const res = await api.feeds.list();
      if (res.success) setFeeds(res.data.feeds || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFavorites = async () => {
    setFavoritesLoading(true);
    setFavoritesError(null);
    try {
      const res = await api.favorites.list();
      if (res.success) setFavorites(res.data.favorites || []);
      else throw new Error(res.error);
    } catch {
      setFavoritesError('Failed to load favorites.');
    } finally {
      setFavoritesLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/');
      else {
        setLoading(false);
        fetchFeeds();
        fetchFavorites();
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate('/');
      else setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleArticleClick = fav =>
    setSelectedArticle({
      id: fav.articleId,
      title: fav.title,
      url: fav.url,
      description: fav.description,
      feedTitle: fav.feedTitle || 'Unknown Feed',
      publishedAt: fav.createdAt,
      imageUrl: fav.imageUrl || null,
    });

  const handleRemoveFromFavorites = async () => {
    if (!selectedArticle) return;
    try {
      await api.articles.removeFromFavorites(selectedArticle.id);
      setSelectedArticle(null);
      await fetchFavorites();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveFavoriteFromList = async (e, articleId) => {
    e.stopPropagation();
    try {
      await api.articles.removeFromFavorites(articleId);
      await fetchFavorites();
    } catch (e) {
      console.error(e);
    }
  };

  const handleImport = async () => {
    if (!importForm.title || !importForm.url) {
      setImportMsg({ type: 'error', text: 'タイトルとURLは必須です' });
      return;
    }
    setImporting(true);
    setImportMsg(null);
    try {
      const token = await getAccessToken();
      const articleId = crypto.randomUUID();
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articleId,
          title: importForm.title,
          url: importForm.url,
          feedTitle: importForm.feedTitle,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setImportMsg({ type: 'success', text: '追加しました' });
        setImportForm({ title: '', url: '', feedTitle: '' });
        await fetchFavorites();
      } else {
        setImportMsg({ type: 'error', text: data.error || '失敗しました' });
      }
    } catch {
      setImportMsg({ type: 'error', text: '失敗しました' });
    } finally {
      setImporting(false);
    }
  };

  const getRelativeTime = d => {
    if (!d) return '';
    const diff = Math.floor((Date.now() - new Date(d)) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(d).toLocaleDateString();
  };

  const getFeedFavicon = feedTitle =>
    feeds.find(f => f.title === feedTitle)?.faviconUrl || null;

  const cycleViewMode = () =>
    setViewMode(v => (v === 'card' ? 'list' : v === 'list' ? 'magazine' : 'card'));

  const viewModeLabel =
    viewMode === 'card' ? (
      <>
        <FaList /> List
      </>
    ) : viewMode === 'list' ? (
      <>
        <FaNewspaper /> Magazine
      </>
    ) : (
      <>
        <FaTh /> Card
      </>
    );

  /* renderCard / renderListRow / renderMagazineRow / renderByMode
     ※ ここは元コードから変更なし */
  // --- 省略せずそのまま使用してください ---

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: bg }}>
        <Navigation />
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #FF6B35',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto',
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: bg }}>
      <Navigation />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 2rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FaStar style={{ color: '#FFD700', fontSize: '1.4rem' }} />
            <h1
              style={{ color: textPrimary, fontSize: '1.5rem', fontWeight: '700', margin: 0 }}
            >
              Favorites
            </h1>
            <span
              style={{
                backgroundColor: '#FF6B35',
                color: 'white',
                borderRadius: '12px',
                padding: '0.15rem 0.6rem',
                fontSize: '0.82rem',
                fontWeight: '700',
              }}
            >
              {favorites.length}
            </span>
          </div>
          <button
            onClick={cycleViewMode}
            style={{
              padding: '0.35rem 0.9rem',
              border: `1px solid ${border}`,
              borderRadius: '20px',
              backgroundColor: 'transparent',
              color: textSecondary,
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            {viewModeLabel}
          </button>
        </div> {/* ← ヘッダーのdivの閉じタグ */}

        {SHOW_IMPORT_FORM && (
          <div
            style={{
              backgroundColor: cardBg,
              border: `1px solid ${border}`,
              borderRadius: '10px',
              padding: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <p
              style={{
                color: textSecondary,
                fontSize: '0.82rem',
                fontWeight: '700',
                margin: '0 0 0.75rem',
              }}
            >
              📥 移管用インポート
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input
                placeholder="タイトル *"
                value={importForm.title}
                onChange={e =>
                  setImportForm(p => ({ ...p, title: e.target.value }))
                }
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: `1px solid ${border}`,
                  backgroundColor: isDarkMode ? '#333' : '#fff',
                  color: textPrimary,
                  fontSize: '0.9rem',
                }}
              />
              <input
                placeholder="URL *"
                value={importForm.url}
                onChange={e =>
                  setImportForm(p => ({ ...p, url: e.target.value }))
                }
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: `1px solid ${border}`,
                  backgroundColor: isDarkMode ? '#333' : '#fff',
                  color: textPrimary,
                  fontSize: '0.9rem',
                }}
              />
              <input
                placeholder="フィード名（任意）"
                value={importForm.feedTitle}
                onChange={e =>
                  setImportForm(p => ({ ...p, feedTitle: e.target.value }))
                }
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: `1px solid ${border}`,
                  backgroundColor: isDarkMode ? '#333' : '#fff',
                  color: textPrimary,
                  fontSize: '0.9rem',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  style={{
                    padding: '0.4rem 1rem',
                    backgroundColor: '#FF6B35',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    opacity: importing ? 0.7 : 1,
                  }}
                >
                  {importing ? '追加中...' : '追加'}
                </button>
                {importMsg && (
                  <span
                    style={{
                      fontSize: '0.82rem',
                      color:
                        importMsg.type === 'success' ? '#28a745' : '#dc3545',
                    }}
                  >
                    {importMsg.text}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {favoritesLoading && <p style={{ textAlign: 'center' }}>Loading...</p>}
        {favoritesError && (
          <p style={{ color: 'red', textAlign: 'center' }}>{favoritesError}</p>
        )}
        {!favoritesLoading && !favoritesError && favorites.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem', color: textSecondary }}>
            <FaStar style={{ fontSize: '3rem', opacity: 0.2, marginBottom: '1rem' }} />
            <p>No favorite articles yet.</p>
            <p>Star articles from the dashboard to save them here!</p>
          </div>
        )}
        {!favoritesLoading &&
          !favoritesError &&
          favorites.length > 0 &&
          renderByMode(favorites)}
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
