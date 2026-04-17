import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { FaBookmark, FaTrash, FaList, FaTh, FaRss, FaStar, FaSync } from 'react-icons/fa';
import { getAccessToken } from '../lib/supabase';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';
import Navigation from '../components/Navigation';
import ArticleModal from '../components/ArticleModal';
import { useTheme } from '../contexts/ThemeContext';
import { usePersistedState } from '../hooks/usePersistedState';

const ReadLaterPage = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [favoritedIds, setFavoritedIds] = useState(new Set());
  const [readIds, setReadIds] = useState(new Set()); // 開いた記事（薄く表示）
  const { isDarkMode } = useTheme();
  const [viewMode, setViewMode] = usePersistedState('readlater_viewMode', 'list');

  const bg = isDarkMode ? '#1a1a1a' : '#f0f0f0';
  const cardBg = isDarkMode ? '#2d2d2d' : '#ffffff';
  const border = isDarkMode ? '#444' : '#e0e0e0';
  const textPrimary = isDarkMode ? '#e0e0e0' : '#222';
  const textSecondary = isDarkMode ? '#aaa' : '#888';

  const apiClient = useMemo(() => createApiClient(
    import.meta.env.VITE_API_BASE_URL || '',
    getAccessToken
  ), []);
  const api = useMemo(() => new FeedOwnAPI(apiClient), [apiClient]);

  const callReadLaterAPI = useCallback(async (method, body = null, query = '') => {
    const token = await getAccessToken();
    const res = await fetch(`/api/read-later${query}`, {
      method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }, []);

  // 初回取得
  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await callReadLaterAPI('GET');
      if (data.success) setArticles(data.data.articles || []);
      else setError(data.error);
    } catch (e) {
      setError('Failed to load Read Later articles.');
    } finally {
      setLoading(false);
    }
  }, [callReadLaterAPI]);

  // Refresh: 既読記事を除外してから再取得
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    const currentReadIds = new Set(readIds); // 現在の既読セットを保存
    try {
      const data = await callReadLaterAPI('GET');
      if (data.success) {
        // 既読のものを除外して更新
        const fresh = (data.data.articles || []).filter(
          a => !currentReadIds.has(a.article_id)
        );
        setArticles(fresh);
        setReadIds(new Set()); // 既読セットをリセット
      }
    } catch (e) {
      setError('Failed to refresh.');
    } finally {
      setRefreshing(false);
    }
  }, [callReadLaterAPI, readIds]);

  const fetchFavorites = useCallback(async () => {
    try {
      const res = await api.favorites.list();
      if (res.success) setFavoritedIds(new Set(res.data.favorites.map(f => f.articleId)));
    } catch (e) { console.error(e); }
  }, [api]);

  useEffect(() => {
    fetchArticles();
    fetchFavorites();
  }, [fetchArticles, fetchFavorites]);

  // 記事を開く → 既読セットに追加（リストには残る・薄く表示）
  const handleArticleClick = useCallback((article) => {
    const formatted = {
      id: article.article_id,
      title: article.title,
      url: article.url,
      description: article.description,
      feedTitle: article.feed_title || 'Unknown Feed',
      publishedAt: article.saved_at,
      imageUrl: article.image_url || null,
    };
    setSelectedArticle(formatted);
    setReadIds(prev => new Set([...prev, article.article_id]));
    api.articles.markAsRead(article.article_id).catch(console.error);
    callReadLaterAPI('DELETE', null, `?articleId=${encodeURIComponent(article.article_id)}`).catch(console.error);
  }, [api]);

  const handleRemove = async (articleId) => {
    try {
      await callReadLaterAPI('DELETE', null, `?articleId=${encodeURIComponent(articleId)}`);
      setArticles(prev => prev.filter(a => a.article_id !== articleId));
      if (selectedArticle?.id === articleId) setSelectedArticle(null);
    } catch (e) { console.error(e); }
  };

  const handleToggleFavorite = useCallback(async () => {
    if (!selectedArticle) return;
    const isFav = favoritedIds.has(selectedArticle.id);
    try {
      if (isFav) {
        await api.articles.removeFromFavorites(selectedArticle.id);
        setFavoritedIds(prev => { const s = new Set(prev); s.delete(selectedArticle.id); return s; });
      } else {
        await api.articles.addToFavorites(selectedArticle.id, {
          title: selectedArticle.title, url: selectedArticle.url,
          description: selectedArticle.description, feedTitle: selectedArticle.feedTitle,
          imageUrl: selectedArticle.imageUrl,
        });
        setFavoritedIds(prev => new Set([...prev, selectedArticle.id]));
      }
    } catch (e) { console.error(e); }
  }, [selectedArticle, favoritedIds, api]);

  const handleToggleFavoriteById = useCallback(async (e, article) => {
    e.stopPropagation();
    const isFav = favoritedIds.has(article.article_id);
    try {
      if (isFav) {
        await api.articles.removeFromFavorites(article.article_id);
        setFavoritedIds(prev => { const s = new Set(prev); s.delete(article.article_id); return s; });
      } else {
        await api.articles.addToFavorites(article.article_id, {
          title: article.title, url: article.url,
          description: article.description, feedTitle: article.feed_title, imageUrl: article.image_url,
        });
        setFavoritedIds(prev => new Set([...prev, article.article_id]));
      }
    } catch (e) { console.error(e); }
  }, [favoritedIds, api]);

  const getRelativeTime = (d) => {
    if (!d) return '';
    const diff = Math.floor((Date.now() - new Date(d)) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(d).toLocaleDateString();
  };

  const readCount = readIds.size;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: bg }}>
      <Navigation />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FaBookmark style={{ color: '#FF6B35', fontSize: '1.4rem' }} />
            <h1 style={{ color: textPrimary, fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>Read Later</h1>
            <span style={{ backgroundColor: '#FF6B35', color: 'white', borderRadius: '12px', padding: '0.15rem 0.6rem', fontSize: '0.82rem', fontWeight: '700' }}>
              {articles.length}
            </span>
            {readCount > 0 && (
              <span style={{ color: textSecondary, fontSize: '0.82rem' }}>
                ({readCount}件既読 · Refreshで消去)
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              style={{
                padding: '0.35rem 0.9rem', backgroundColor: '#FF6B35', color: 'white',
                border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                opacity: (refreshing || loading) ? 0.7 : 1,
              }}
            >
              <FaSync style={{ animation: (refreshing || loading) ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>

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
        </div>

        {(loading || refreshing) && (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ width: '32px', height: '32px', border: '4px solid #f3f3f3', borderTop: '4px solid #FF6B35', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        )}

        {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}

        {!loading && !refreshing && articles.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem', color: textSecondary }}>
            <FaBookmark style={{ fontSize: '3rem', opacity: 0.2, marginBottom: '1rem' }} />
            <p style={{ fontSize: '1.1rem' }}>Read Laterに保存した記事はありません</p>
          </div>
        )}

        {/* CARD VIEW */}
        {!loading && !refreshing && articles.length > 0 && viewMode === 'card' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {articles.map(article => {
              const isFav = favoritedIds.has(article.article_id);
              const isRead = readIds.has(article.article_id);
              return (
                <div
                  key={article.id}
                  onClick={() => handleArticleClick(article)}
                  style={{
                    backgroundColor: cardBg, borderRadius: '10px', overflow: 'hidden',
                    border: `1px solid ${border}`,
                    boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
                    cursor: 'pointer', position: 'relative',
                    opacity: isRead ? 0.55 : 1, // 開いた記事は薄く
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                  onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)'; }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)'; }}
                >
                  {isRead && (
                    <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 2, backgroundColor: '#28a745', borderRadius: '6px', padding: '0.15rem 0.4rem', fontSize: '0.7rem', color: 'white', fontWeight: '600' }}>
                      ✓ Read
                    </div>
                  )}
                  {article.image_url ? (
                    <img src={article.image_url} alt="" style={{ width: '100%', height: '150px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '60px', backgroundColor: isDarkMode ? '#333' : '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FaRss style={{ color: '#FF6B35', opacity: 0.3, fontSize: '1.2rem' }} />
                    </div>
                  )}
                  <div style={{ padding: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', fontSize: '0.78rem', color: textSecondary }}>
                      <span style={{ color: '#FF6B35', fontWeight: '600' }}>{article.feed_title || 'Feed'}</span>
                      <span>·</span>
                      <span>{getRelativeTime(article.saved_at)}</span>
                    </div>
                    <h3 style={{ color: textPrimary, fontSize: '0.92rem', fontWeight: '600', lineHeight: '1.4', margin: '0 0 0.4rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {article.title}
                    </h3>
                    {article.description && (
                      <p style={{ color: textSecondary, fontSize: '0.8rem', lineHeight: '1.5', margin: '0 0 0.75rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {article.description}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={e => handleToggleFavoriteById(e, article)}
                        style={{
                          padding: '0.25rem 0.6rem',
                          backgroundColor: isFav ? '#FFD700' : 'transparent',
                          color: isFav ? 'white' : textSecondary,
                          border: `1px solid ${isFav ? '#FFD700' : border}`,
                          borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem',
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                        }}
                      >
                        <FaStar /> {isFav ? 'Favorited' : 'Favorite'}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleRemove(article.article_id); }}
                        style={{
                          padding: '0.25rem 0.6rem', backgroundColor: 'transparent',
                          color: textSecondary, border: `1px solid ${border}`,
                          borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem',
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                        }}
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* LIST VIEW */}
        {!loading && !refreshing && articles.length > 0 && viewMode === 'list' && (
          <div style={{ backgroundColor: cardBg, borderRadius: '10px', border: `1px solid ${border}`, overflow: 'hidden' }}>
            {articles.map((article, idx) => {
              const isFav = favoritedIds.has(article.article_id);
              const isRead = readIds.has(article.article_id);
              return (
                <div
                  key={article.id}
                  onClick={() => handleArticleClick(article)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.65rem 1rem',
                    borderBottom: idx < articles.length - 1 ? `1px solid ${border}` : 'none',
                    cursor: 'pointer',
                    opacity: isRead ? 0.55 : 1, // 開いた記事は薄く
                  }}
                  onMouseOver={e => { e.currentTarget.style.backgroundColor = isDarkMode ? '#333' : '#f9f9f9'; }}
                  onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {/* 星ボタン */}
                  <button
                    onClick={e => handleToggleFavoriteById(e, article)}
                    title={isFav ? 'Favoritesから削除' : 'Favoritesに追加'}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                      color: isFav ? '#FFD700' : textSecondary, fontSize: '0.9rem', flexShrink: 0,
                    }}
                  >
                    <FaStar />
                  </button>

                  {isRead && <span style={{ color: '#28a745', fontSize: '0.75rem', flexShrink: 0 }}>✓</span>}

                  <span style={{ color: '#FF6B35', fontSize: '0.82rem', fontWeight: '600', minWidth: '100px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {article.feed_title || 'Feed'}
                  </span>

                  <span style={{ color: textPrimary, fontSize: '0.9rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {article.title}
                  </span>

                  <span style={{ color: textSecondary, fontSize: '0.8rem', flexShrink: 0 }}>
                    {getRelativeTime(article.saved_at)}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); handleRemove(article.article_id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: textSecondary, fontSize: '0.8rem', flexShrink: 0, padding: '2px 4px' }}
                  >
                    <FaTrash />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedArticle && (
        <ArticleModal
          article={selectedArticle}
          onClose={() => setSelectedArticle(null)}
          onMarkAsRead={() => {}}
          onToggleFavorite={handleToggleFavorite}
          isRead={false}
          isFavorited={favoritedIds.has(selectedArticle?.id)}
        />
      )}
    </div>
  );
};

export default ReadLaterPage;
