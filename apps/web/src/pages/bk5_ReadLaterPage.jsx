import React, { useEffect, useState, useCallback } from 'react';
import { FaBookmark, FaTrash, FaExternalLinkAlt, FaRss, FaList, FaTh } from 'react-icons/fa';
import { getAccessToken } from '../lib/supabase';
import Navigation from '../components/Navigation';
import { useTheme } from '../contexts/ThemeContext';
import { usePersistedState } from '../hooks/usePersistedState';

const ReadLaterPage = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checkedIds, setCheckedIds] = useState(new Set());
  const { isDarkMode } = useTheme();
  const [viewMode, setViewMode] = usePersistedState('readlater_viewMode', 'list');

  const bg = isDarkMode ? '#1a1a1a' : '#f0f0f0';
  const cardBg = isDarkMode ? '#2d2d2d' : '#ffffff';
  const border = isDarkMode ? '#444' : '#e0e0e0';
  const textPrimary = isDarkMode ? '#e0e0e0' : '#222';
  const textSecondary = isDarkMode ? '#aaa' : '#888';

  const callAPI = useCallback(async (method, body = null, query = '') => {
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
      const data = await callAPI('GET');
      if (data.success) setArticles(data.data.articles || []);
      else setError(data.error);
    } catch (e) {
      setError('Failed to load Read Later articles.');
    } finally {
      setLoading(false);
    }
  }, [callAPI]);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const handleRemove = async (articleId) => {
    try {
      await callAPI('DELETE', null, `?articleId=${encodeURIComponent(articleId)}`);
      setArticles(prev => prev.filter(a => a.article_id !== articleId));
      setCheckedIds(prev => { const s = new Set(prev); s.delete(articleId); return s; });
    } catch (e) { console.error('Failed to remove:', e); }
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

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ width: '32px', height: '32px', border: '4px solid #f3f3f3', borderTop: '4px solid #FF6B35', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        )}

        {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}

        {/* Empty */}
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
              return (
                <div key={article.id} style={{
                  backgroundColor: cardBg, borderRadius: '10px', overflow: 'hidden',
                  border: isChecked ? '2px solid #FF6B35' : `1px solid ${border}`,
                  boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
                  position: 'relative',
                }}>
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
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <a href={article.url} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ flex: 1, padding: '0.3rem 0.6rem', backgroundColor: '#FF6B35', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', textDecoration: 'none' }}>
                        <FaExternalLinkAlt /> 開く
                      </a>
                      <button onClick={() => handleRemove(article.article_id)}
                        style={{ padding: '0.3rem 0.6rem', backgroundColor: 'transparent', color: textSecondary, border: `1px solid ${border}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
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
        {!loading && articles.length > 0 && viewMode === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {articles.map(article => {
              const isChecked = checkedIds.has(article.article_id);
              return (
                <div key={article.id} style={{
                  backgroundColor: cardBg, borderRadius: '10px',
                  border: isChecked ? '2px solid #FF6B35' : `1px solid ${border}`,
                  padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-start',
                }}>
                  <input type="checkbox" checked={isChecked}
                    onChange={e => toggleCheck(e, article.article_id)}
                    style={{ width: '16px', height: '16px', accentColor: '#FF6B35', cursor: 'pointer', flexShrink: 0, marginTop: '3px' }}
                  />
                  {article.image_url && (
                    <img src={article.image_url} alt="" style={{ width: '100px', height: '70px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem', fontSize: '0.78rem', color: textSecondary }}>
                      <span style={{ color: '#FF6B35', fontWeight: '600' }}>{article.feed_title || 'Feed'}</span>
                      <span>·</span>
                      <span>{getRelativeTime(article.saved_at)}</span>
                    </div>
                    <h3 style={{ color: textPrimary, fontSize: '1rem', fontWeight: '600', margin: '0 0 0.3rem', lineHeight: '1.4' }}>
                      {article.title}
                    </h3>
                    {article.description && (
                      <p style={{ color: textSecondary, fontSize: '0.85rem', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {article.description}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0 }}>
                    <a href={article.url} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ padding: '0.35rem 0.75rem', backgroundColor: '#FF6B35', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}>
                      <FaExternalLinkAlt /> 開く
                    </a>
                    <button onClick={() => handleRemove(article.article_id)}
                      style={{ padding: '0.35rem 0.75rem', backgroundColor: 'transparent', color: textSecondary, border: `1px solid ${border}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <FaTrash /> 削除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReadLaterPage;
