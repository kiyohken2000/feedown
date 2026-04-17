import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { FaBookmark, FaTrash, FaList, FaTh, FaRss, FaStar } from 'react-icons/fa';
import { getAccessToken } from '../lib/supabase';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';
import Navigation from '../components/Navigation';
import ArticleModal from '../components/ArticleModal';
import { useTheme } from '../contexts/ThemeContext';
import { usePersistedState } from '../hooks/usePersistedState';

const ReadLaterPage = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [favoritedIds, setFavoritedIds] = useState(new Set());
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

  // Favorites一覧取得（スター表示用）
  const fetchFavorites = useCallback(async () => {
    try {
      const res = await api.favorites.list();
      if (res.success) {
        setFavoritedIds(new Set(res.data.favorites.map(f => f.articleId)));
      }
    } catch (e) { console.error(e); }
  }, [api]);

  useEffect(() => {
    fetchArticles();
    fetchFavorites();
  }, [fetchArticles, fetchFavorites]);

  const handleRemove = async (articleId) => {
    try {
      await callReadLaterAPI('DELETE', null, `?articleId=${encodeURIComponent(articleId)}`);
      setArticles(prev => prev.filter(a => a.article_id !== articleId));
      setCheckedIds(prev => { const s = new Set(prev); s.delete(articleId); return s; });
      if (selectedArticle?.id === articleId) setSelectedArticle(null);
    } catch (e) { console.error(e); }
  };

  const handleRemoveChecked = async () => {
    for (const id of [...checkedIds]) await handleRemove(id);
    setCheckedIds(new Set());
  };

  const handleCheckAll = () => {
    if (checkedIds.size === articles.length) setCheckedIds(new Set());
    else setCheckedIds(new Set(articles.map(a => a.article_id)));
  };

  const toggleCheck = (e, articleId) => {
    e.stopPropagation();
    setCheckedIds(prev => {
      const s = new Set(prev);
      s.has(articleId) ? s.delete(articleId) : s.add(articleId);
      return s;
    });
  };

  // Read Later記事をArticleModal用フォーマットに変換
  const toArticleFormat = (a) => ({
    id: a.article_id,
    title: a.title,
    url: a.url,
    description: a.description,
    feedTitle: a.feed_title || 'Unknown Feed',
    publishedAt: a.saved_at,
    imageUrl: a.image_url || null,
  });

  const handleArticleClick = (article) => {
    setSelectedArticle(toArticleFormat(article));
  };

  // Favorites追加/削除
  const handleToggleFavorite = useCallback(async () => {
    if (!selectedArticle) return;
    const isFav = favoritedIds.has(selectedArticle.id);
    try {
      if (isFav) {
        await api.articles.removeFromFavorites(selectedArticle.id);
        setFavoritedIds(prev => { const s = new Set(prev); s.delete(selectedArticle.id); return s; });
      } else {
        await api.articles.addToFavorites(selectedArticle.id, {
          title: selectedArticle.title,
          url: selectedArticle.url,
          description: selectedArticle.description,
          feedTitle: selectedArticle.feedTitle,
          imageUrl: selectedArticle.imageUrl,
        });
        setFavoritedIds(prev => new Set([...prev, selectedArticle.id]));
      }
    } catch (e) { console.error(e); }
  }, [selectedArticle, favoritedIds, api]);

  // リストのスターアイコンから直接Favorites追加/削除
  const handleToggleFavoriteById = useCallback(async (e, article) => {
    e.stopPropagation();
    const articleFormatted = toArticleFormat(article);
    const isFav = favoritedIds.has(article.article_id);
    try {
      if (isFav) {
        await api.articles.removeFromFavorites(article.article_id);
        setFavoritedIds(prev => { const s = new Set(prev); s.delete(article.article_id); return s; });
      } else {
        await api.articles.addToFavorites(article.article_id, {
          title: articleFormatted.title,
          url: articleFormatted.url,
          description: articleFormatted.description,
          feedTitle: articleFormatted.feedTitle,
          imageUrl: articleFormatted.imageUrl,
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

  const allChecked = articles.length > 0 && checkedIds.size === articles.length;
  const someChecked = checkedIds.size > 0 && checkedIds.size < articles.length;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: bg }}>
      <Navigation />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <FaBookmark style={{ color: '#FF6B35', fontSize: '1.4rem' }} />
          <h1 style={{ color: textPrimary, fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>Read Later</h1>
          <span style={{ backgroundColor: '#FF6B35', color: 'white', borderRadius: '12px', padding: '0.15rem 0.6rem', fontSize: '0.82rem', fontWeight: '700' }}>
            {articles.length}
          </span>
        </div>

        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.75rem 1rem', backgroundColor: cardBg,
          borderRadius: '10px', border: `1px solid ${border}`,
          marginBottom: '1rem', flexWrap: 'wrap',
        }}>
          <input
            type="checkbox"
            checked={allChecked}
            ref={el => { if (el) el.indeterminate = someChecked; }}
            onChange={handleCheckAll}
            style={{ width: '16px', height: '16px', accentColor: '#FF6B35', cursor: 'pointer' }}
          />
          <span style={{ color: textSecondary, fontSize: '0.85rem' }}>
            {checkedIds.size > 0 ? `${checkedIds.size}件選択中` : '全選択'}
          </span>
          <div style={{ flex: 1 }} />
          {checkedIds.size > 0 && (
            <button onClick={handleRemoveChecked} style={{
              padding: '0.35rem 0.9rem', backgroundColor: '#dc3545', color: 'white',
              border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '0.83rem', fontWeight: '600',
              display: 'flex', alignItems: 'center', gap: '0.3rem',
            }}>
              <FaTrash /> 選択を削除 ({checkedIds.size})
            </button>
          )}
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

        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ width: '32px', height: '32px', border: '4px solid #f3f3f3', borderTop: '4px solid #FF6B35', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        )}

        {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}

        {!loading && articles.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem', color: textSecondary }}>
            <FaBookmark style={{ fontSize: '3rem', opacity: 0.2, marginBottom: '1rem' }} />
            <p style={{ fontSize: '1.1rem' }}>Read Laterに保存した記事はありません</p>
            <p style={{ fontSize: '0.9rem' }}>記事をスワイプするか、チェックして「Read Later」ボタンを押してください</p>
          </div>
        )}

        {/* CARD VIEW */}
        {!loading && articles.length > 0 && viewMode === 'card' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {articles.map(article => {
              const isChecked = checkedIds.has(article.article_id);
              const isFav = favoritedIds.has(article.article_id);
              return (
                <div
                  key={article.id}
                  onClick={() => handleArticleClick(article)}
                  style={{
                    backgroundColor: cardBg, borderRadius: '10px', overflow: 'hidden',
                    border: isChecked ? '2px solid #FF6B35' : `1px solid ${border}`,
                    boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
                    cursor: 'pointer', position: 'relative',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                  onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)'; }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)'; }}
                >
                  <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 2 }}>
                    <input type="checkbox" checked={isChecked}
                      onChange={e => toggleCheck(e, article.article_id)}
                      onClick={e => e.stopPropagation()}
                      style={{ width: '16px', height: '16px', accentColor: '#FF6B35', cursor: 'pointer' }}
                    />
                  </div>
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
                    {/* Favorites星ボタン */}
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
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* LIST VIEW */}
        {!loading && articles.length > 0 && viewMode === 'list' && (
          <div style={{ backgroundColor: cardBg, borderRadius: '10px', border: `1px solid ${border}`, overflow: 'hidden' }}>
            {articles.map((article, idx) => {
              const isChecked = checkedIds.has(article.article_id);
              const isFav = favoritedIds.has(article.article_id);
              return (
                <div
                  key={article.id}
                  onClick={() => handleArticleClick(article)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.65rem 1rem',
                    borderBottom: idx < articles.length - 1 ? `1px solid ${border}` : 'none',
                    cursor: 'pointer',
                    backgroundColor: isChecked ? (isDarkMode ? '#3a3a2a' : '#fffbe6') : 'transparent',
                  }}
                  onMouseOver={e => { e.currentTarget.style.backgroundColor = isDarkMode ? '#333' : '#f9f9f9'; }}
                  onMouseOut={e => { e.currentTarget.style.backgroundColor = isChecked ? (isDarkMode ? '#3a3a2a' : '#fffbe6') : 'transparent'; }}
                >
                  {/* チェックボックス */}
                  <input type="checkbox" checked={isChecked}
                    onChange={e => toggleCheck(e, article.article_id)}
                    onClick={e => e.stopPropagation()}
                    style={{ width: '16px', height: '16px', accentColor: '#FF6B35', cursor: 'pointer', flexShrink: 0 }}
                  />
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

                  {/* フィード名 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: '120px', maxWidth: '160px', flexShrink: 0 }}>
                    <span style={{ color: '#FF6B35', fontSize: '0.82rem', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {article.feed_title || 'Feed'}
                    </span>
                  </div>

                  {/* タイトル */}
                  <span style={{ color: textPrimary, fontSize: '0.9rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {article.title}
                  </span>

                  {/* 時刻 */}
                  <span style={{ color: textSecondary, fontSize: '0.8rem', flexShrink: 0 }}>
                    {getRelativeTime(article.saved_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ArticleModal */}
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
