// ★ 移管完了したら false に変更
const SHOW_IMPORT_FORM = false;

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaList, FaTh, FaStar, FaRss, FaNewspaper } from 'react-icons/fa';
import { supabase, getAccessToken } from '../lib/supabase';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';
import Navigation from '../components/Navigation';
import ArticleModal from '../components/ArticleModal';
import { useTheme } from '../contexts/ThemeContext';
import { usePersistedState } from '../hooks/usePersistedState';
import { useArticles } from '../contexts/ArticlesContext'; // ★ 追加

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

  // ★ Feeds情報を使ってカテゴリ分け・ファビコン表示をするために追加
  const { feeds: contextFeeds } = useArticles();
  const activeFeeds = contextFeeds.length > 0 ? contextFeeds : feeds;

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

  // ★ データをDashboard/ReadLaterと同じ形式（id, publishedAt等）に正規化
  const normalizeFavorite = (fav) => ({
    ...fav,
    id: fav.articleId,
    publishedAt: fav.createdAt,
  });

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
      if (res.success) {
        setFavorites((res.data.favorites || []).map(normalizeFavorite));
      } else throw new Error(res.error);
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

  const handleArticleClick = fav => {
    setSelectedArticle({
      id: fav.id,
      title: fav.title,
      url: fav.url,
      description: fav.description,
      feedTitle: fav.feedTitle || 'Unknown Feed',
      publishedAt: fav.publishedAt,
      imageUrl: fav.imageUrl || null,
    });
  };

  const handleRemoveFromFavorites = async () => {
    if (!selectedArticle) return;
    try {
      await api.articles.removeFromFavorites(selectedArticle.id);
      setSelectedArticle(null);
      setFavorites(prev => prev.filter(f => f.id !== selectedArticle.id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveFavoriteFromList = async (e, articleId) => {
    e.stopPropagation();
    try {
      await api.articles.removeFromFavorites(articleId);
      setFavorites(prev => prev.filter(f => f.id !== articleId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleImport = async () => {
    if (!importForm.title || !importForm.url) {
      setImportMsg({ type: 'error', text: 'タイトルとURLは必須です' });
      return;
    }
    setImporting(true); setImportMsg(null);
    try {
      const token = await getAccessToken();
      const articleId = crypto.randomUUID();
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, title: importForm.title, url: importForm.url, feedTitle: importForm.feedTitle }),
      });
      const text = await res.text();
      console.log('Favorites import response:', res.status, text);
      let data;
      try { data = JSON.parse(text); } catch { data = { success: false, error: text }; }
      if (data.success) {
        setImportMsg({ type: 'success', text: '追加しました' });
        setImportForm({ title: '', url: '', feedTitle: '' });
        await fetchFavorites();
      } else {
        setImportMsg({ type: 'error', text: data.error || '失敗しました' });
      }
    } catch (e) {
      console.error('Import error:', e);
      setImportMsg({ type: 'error', text: '失敗しました: ' + e.message });
    } finally { setImporting(false); }
  };

  const getRelativeTime = d => {
    if (!d) return '';
    const diff = Math.floor((Date.now() - new Date(d)) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return new Date(d).toLocaleDateString();
  };

  const stripHtml = (html) => html?.replace(/<[^>]*>/g, '') || '';

  // ★ ヘルパー関数追加
  const getFeedFavicon = feedTitle => activeFeeds.find(f => f.title === feedTitle)?.faviconUrl || null;
  const getFeedCategory = useCallback((feedTitle) => activeFeeds.find(f => f.title === feedTitle)?.category || null, [activeFeeds]);

  const cycleViewMode = () => setViewMode(v => (v === 'card' ? 'list' : v === 'list' ? 'magazine' : 'card'));
  const viewModeLabel = viewMode === 'card' ? <><FaList /> List</> : viewMode === 'list' ? <><FaNewspaper /> Magazine</> : <><FaTh /> Card</>;

  // ★ カテゴリごとのグループ化ロジックを追加
  const groupedFavorites = useMemo(() => {
    if (!favorites.length) return [];
    const catMap = {};
    const uncategorized = [];
    favorites.forEach(fav => {
      const cat = getFeedCategory(fav.feedTitle);
      if (cat) {
        if (!catMap[cat]) catMap[cat] = [];
        catMap[cat].push(fav);
      } else {
        uncategorized.push(fav);
      }
    });
    const sorted = Object.entries(catMap).sort(([a], [b]) => a.localeCompare(b, 'ja'));
    if (uncategorized.length > 0) sorted.push(['__uncategorized__', uncategorized]);
    return sorted;
  }, [favorites, getFeedCategory]);

  const useCategoryGroups = groupedFavorites.length > 1 || (groupedFavorites.length === 1 && groupedFavorites[0][0] !== '__uncategorized__');

  // ★ 各レンダラーをDashboardと全く同じレイアウトに修正
  const renderCard = (fav) => (
    <div key={fav.id} onClick={() => handleArticleClick(fav)}
      style={{ backgroundColor: cardBg, borderRadius: '10px', overflow: 'hidden', border: `1px solid ${border}`, boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer', position: 'relative', transition: 'transform 0.2s, box-shadow 0.2s' }}
      onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)'; }}
      onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)'; }}
    >
      {fav.imageUrl
        ? <img src={fav.imageUrl} alt="" style={{ width: '100%', height: '150px', objectFit: 'cover' }} />
        : <div style={{ width: '100%', height: '60px', backgroundColor: isDarkMode ? '#333' : '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaRss style={{ color: '#FF6B35', opacity: 0.3, fontSize: '1.2rem' }} /></div>
      }
      <div style={{ padding: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', fontSize: '0.78rem', color: textSecondary }}>
          {getFeedFavicon(fav.feedTitle) && <img src={getFeedFavicon(fav.feedTitle)} alt="" style={{ width: '13px', height: '13px', borderRadius: '2px' }} onError={e => e.target.style.display = 'none'} />}
          <span style={{ color: textSecondary, fontWeight: '600' }}>{fav.feedTitle || 'Feed'}</span>
          <span>·</span><span>{getRelativeTime(fav.publishedAt)}</span>
        </div>
        <h3 style={{ color: textPrimary, fontSize: '0.92rem', fontWeight: '600', lineHeight: '1.4', margin: '0 0 0.4rem', textAlign: 'left', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{stripHtml(fav.title)}</h3>
        {fav.description && <p style={{ color: textSecondary, fontSize: '0.8rem', lineHeight: '1.5', margin: '0 0 0.75rem', textAlign: 'left', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: fav.description }} />}
        
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
          <button onClick={e => handleRemoveFavoriteFromList(e, fav.id)} title="お気に入りから削除"
            style={{ padding: '0.25rem 0.6rem', backgroundColor: 'transparent', color: '#FFD700', border: `1px solid #FFD700`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <FaStar /> Favorited
          </button>
        </div>
      </div>
    </div>
  );

  const renderListRow = (fav, idx, total) => (
    <div key={fav.id} onClick={() => handleArticleClick(fav)}
      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 1rem', borderBottom: idx < total - 1 ? `1px solid ${border}` : 'none', cursor: 'pointer' }}
      onMouseOver={e => { e.currentTarget.style.backgroundColor = isDarkMode ? '#333' : '#f9f9f9'; }}
      onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <button onClick={e => handleRemoveFavoriteFromList(e, fav.id)} title="お気に入りから削除"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: '#FFD700', fontSize: '0.9rem', flexShrink: 0 }}><FaStar /></button>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '5em', flexShrink: 0, overflow: 'hidden' }}>
        {getFeedFavicon(fav.feedTitle) ? <img src={getFeedFavicon(fav.feedTitle)} alt="" style={{ width: '14px', height: '14px', borderRadius: '2px', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} /> : <FaRss style={{ fontSize: '0.75rem', color: '#FF6B35', flexShrink: 0 }} />}
        <span style={{ color: textSecondary, fontSize: '0.82rem', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{fav.feedTitle || 'Feed'}</span>
      </div>
      <span style={{ color: textPrimary, fontSize: '0.9rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{stripHtml(fav.title)}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, fontSize: '0.8rem', color: textSecondary }}>
        <span>{getRelativeTime(fav.publishedAt)}</span>
      </div>
    </div>
  );

  const renderMagazineRow = (fav, idx, total) => (
    <div key={fav.id} onClick={() => handleArticleClick(fav)}
      style={{ display: 'flex', gap: '1rem', padding: '1rem', borderBottom: idx < total - 1 ? `1px solid ${border}` : 'none', cursor: 'pointer', alignItems: 'flex-start' }}
      onMouseOver={e => { e.currentTarget.style.backgroundColor = isDarkMode ? '#333' : '#f5f5f5'; }}
      onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      {fav.imageUrl
        ? <img src={fav.imageUrl} alt="" style={{ width: '160px', height: '110px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
        : <div style={{ width: '160px', height: '110px', backgroundColor: isDarkMode ? '#333' : '#eee', borderRadius: '8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaRss style={{ color: '#FF6B35', opacity: 0.3, fontSize: '1.5rem' }} /></div>
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', fontSize: '0.8rem', color: textSecondary }}>
          {getFeedFavicon(fav.feedTitle) && <img src={getFeedFavicon(fav.feedTitle)} alt="" style={{ width: '14px', height: '14px', borderRadius: '2px' }} onError={e => e.target.style.display = 'none'} />}
          <span style={{ color: textSecondary, fontWeight: '600' }}>{fav.feedTitle || 'Feed'}</span>
          <span>·</span><span>{getRelativeTime(fav.publishedAt)}</span>
        </div>
        <h3 style={{ color: textPrimary, fontSize: '1rem', fontWeight: '700', lineHeight: '1.5', margin: '0 0 0.5rem', textAlign: 'left' }}>{stripHtml(fav.title)}</h3>
        {fav.description && <p style={{ color: textSecondary, fontSize: '0.85rem', lineHeight: '1.6', margin: '0 0 0.6rem', textAlign: 'left', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: fav.description }} />}
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={e => handleRemoveFavoriteFromList(e, fav.id)} title="お気に入りから削除"
            style={{ padding: '0.2rem 0.55rem', backgroundColor: 'transparent', color: '#FFD700', border: `1px solid #FFD700`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <FaStar /> Favorited
          </button>
        </div>
      </div>
    </div>
  );

  const renderArticlesByMode = (favList) => {
    if (viewMode === 'card') return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {favList.map(fav => renderCard(fav))}
      </div>
    );
    if (viewMode === 'list') return (
      <div style={{ backgroundColor: cardBg, borderRadius: '10px', border: `1px solid ${border}`, overflow: 'hidden' }}>
        {favList.map((fav, i) => renderListRow(fav, i, favList.length))}
      </div>
    );
    return (
      <div style={{ backgroundColor: cardBg, borderRadius: '10px', border: `1px solid ${border}`, overflow: 'hidden' }}>
        {favList.map((fav, i) => renderMagazineRow(fav, i, favList.length))}
      </div>
    );
  };

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
        </div>

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

        {/* ★ カテゴリごとのレンダリング (Dashboard / ReadLater と同じロジック) */}
        {!favoritesLoading && !favoritesError && favorites.length > 0 && useCategoryGroups && groupedFavorites.map(([cat, favList]) => (
          <div key={cat} style={{ marginBottom: '2rem' }}>
            {/* ★ ここがオレンジの帯！ */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: `2px solid ${isDarkMode ? '#444' : '#e0e0e0'}`, borderLeft: '4px solid #FF6B35', paddingLeft: '0.5rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: '700', color: textSecondary, textAlign: 'left' }}>
                {cat === '__uncategorized__' ? 'Others' : cat}
              </span>
              <span style={{ fontSize: '0.78rem', color: textSecondary }}>{favList.length}件</span>
            </div>
            {renderArticlesByMode(favList)}
          </div>
        ))}

        {/* カテゴリがない（全て未分類など）の場合はフラットに表示 */}
        {!favoritesLoading && !favoritesError && favorites.length > 0 && !useCategoryGroups && renderArticlesByMode(favorites)}
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
