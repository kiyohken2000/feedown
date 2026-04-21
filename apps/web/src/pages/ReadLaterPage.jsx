// ★ 移管完了したら false に変更
const SHOW_IMPORT_FORM = true;

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { FaBookmark, FaTrash, FaList, FaTh, FaRss, FaStar, FaSync, FaNewspaper } from 'react-icons/fa';
import { getAccessToken } from '../lib/supabase';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';
import Navigation from '../components/Navigation';
import ArticleModal from '../components/ArticleModal';
import { useTheme } from '../contexts/ThemeContext';
import { usePersistedState } from '../hooks/usePersistedState';
import { useArticles } from '../contexts/ArticlesContext'; // ★ 追加

const ReadLaterPage = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [favoritedIds, setFavoritedIds] = useState(new Set());
  const [readIds, setReadIds] = useState(new Set());
  
  const { isDarkMode } = useTheme();
  const [viewMode, setViewMode] = usePersistedState('readlater_viewMode', 'list');
  const [importForm, setImportForm] = useState({ title: '', url: '', feedTitle: '' });
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState(null);

  // ★ Feeds情報を使ってカテゴリ分け・ファビコン表示をするために追加
  const { feeds } = useArticles();

  const bg = isDarkMode ? '#1a1a1a' : '#f0f0f0';
  const cardBg = isDarkMode ? '#2d2d2d' : '#ffffff';
  const border = isDarkMode ? '#444' : '#e0e0e0';
  const textPrimary = isDarkMode ? '#e0e0e0' : '#222';
  const textSecondary = isDarkMode ? '#aaa' : '#888';

  const apiClient = useMemo(() => createApiClient(import.meta.env.VITE_API_BASE_URL || '', getAccessToken), []);
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

  // ★ データをDashboardと同じ形式（id, publishedAt等）に正規化
  const normalizeArticle = (a) => ({
    id: a.article_id,
    title: a.title,
    url: a.url,
    description: a.description,
    feedTitle: a.feed_title || 'Unknown Feed',
    publishedAt: a.saved_at,
    imageUrl: a.image_url || null,
  });

  const fetchArticles = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await callReadLaterAPI('GET');
      if (data.success) {
        setArticles((data.data.articles || []).map(normalizeArticle));
      } else setError(data.error);
    } catch { setError('Failed to load Read Later articles.'); }
    finally { setLoading(false); }
  }, [callReadLaterAPI]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true); setError(null);
    try {
      const data = await callReadLaterAPI('GET');
      if (data.success) { 
        setArticles(data.data.articles.map(normalizeArticle)); 
        setReadIds(new Set()); 
      }
    } catch { setError('Failed to refresh.'); }
    finally { setRefreshing(false); }
  }, [callReadLaterAPI]);

  const fetchFavorites = useCallback(async () => {
    try {
      const res = await api.favorites.list();
      if (res.success) setFavoritedIds(new Set(res.data.favorites.map(f => f.articleId)));
    } catch (e) { console.error(e); }
  }, [api]);

  useEffect(() => { fetchArticles(); fetchFavorites(); }, [fetchArticles, fetchFavorites]);

  const handleRemove = async (articleId) => {
    try {
      await callReadLaterAPI('DELETE', null, `?articleId=${encodeURIComponent(articleId)}`);
      setArticles(prev => prev.filter(a => a.id !== articleId));
      if (selectedArticle?.id === articleId) setSelectedArticle(null);
    } catch (e) { console.error(e); }
  };

  const handleImport = async () => {
    if (!importForm.title || !importForm.url) {
      setImportMsg({ type: 'error', text: 'タイトルとURLは必須です' });
      return;
    }
    setImporting(true); setImportMsg(null);
    try {
      const articleId = crypto.randomUUID();
      const data = await callReadLaterAPI('POST', {
        articleId, title: importForm.title, url: importForm.url, feedTitle: importForm.feedTitle,
      });
      if (data.success) {
        setImportMsg({ type: 'success', text: '追加しました' });
        setImportForm({ title: '', url: '', feedTitle: '' });
        await handleRefresh();
      } else {
        setImportMsg({ type: 'error', text: data.error || '失敗しました' });
      }
    } catch (e) {
      setImportMsg({ type: 'error', text: '失敗しました: ' + e.message });
    } finally { setImporting(false); }
  };

  const handleArticleClick = useCallback((article) => {
    setSelectedArticle(article);
    setReadIds(prev => new Set([...prev, article.id]));
    callReadLaterAPI('DELETE', null, `?articleId=${encodeURIComponent(article.id)}`).catch(console.error);
    api.articles.markAsRead(article.id).catch(console.error);
  }, [api, callReadLaterAPI]);

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
          description: selectedArticle.description, feedTitle: selectedArticle.feedTitle, imageUrl: selectedArticle.imageUrl,
        });
        setFavoritedIds(prev => new Set([...prev, selectedArticle.id]));
      }
    } catch (e) { console.error(e); }
  }, [selectedArticle, favoritedIds, api]);

  const handleToggleFavoriteById = useCallback(async (e, article) => {
    e.stopPropagation();
    const isFav = favoritedIds.has(article.id);
    try {
      if (isFav) {
        await api.articles.removeFromFavorites(article.id);
        setFavoritedIds(prev => { const s = new Set(prev); s.delete(article.id); return s; });
      } else {
        await api.articles.addToFavorites(article.id, {
          title: article.title, url: article.url, description: article.description,
          feedTitle: article.feedTitle, imageUrl: article.imageUrl,
        });
        setFavoritedIds(prev => new Set([...prev, article.id]));
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

  const stripHtml = (html) => html?.replace(/<[^>]*>/g, '') || '';
  
  // ★ ヘルパー関数追加
  const getFeedFavicon = (feedTitle) => feeds.find(f => f.title === feedTitle)?.faviconUrl || null;
  const getFeedCategory = useCallback((feedTitle) => feeds.find(f => f.title === feedTitle)?.category || null, [feeds]);

  const cycleViewMode = () => setViewMode(v => v === 'card' ? 'list' : v === 'list' ? 'magazine' : 'card');
  const viewModeLabel = viewMode === 'card' ? <><FaList /> List</> : viewMode === 'list' ? <><FaNewspaper /> Magazine</> : <><FaTh /> Card</>;
  const readCount = readIds.size;

  // ★ カテゴリごとのグループ化ロジックを追加
  const groupedArticles = useMemo(() => {
    if (!articles.length) return [];
    const catMap = {};
    const uncategorized = [];
    articles.forEach(article => {
      const cat = getFeedCategory(article.feedTitle);
      if (cat) {
        if (!catMap[cat]) catMap[cat] = [];
        catMap[cat].push(article);
      } else {
        uncategorized.push(article);
      }
    });
    const sorted = Object.entries(catMap).sort(([a], [b]) => a.localeCompare(b, 'ja'));
    if (uncategorized.length > 0) sorted.push(['__uncategorized__', uncategorized]);
    return sorted;
  }, [articles, getFeedCategory]);

  const useCategoryGroups = groupedArticles.length > 1 || (groupedArticles.length === 1 && groupedArticles[0][0] !== '__uncategorized__');

  // ★ 各レンダラーをDashboardと全く同じレイアウトに修正
  const renderCard = (article) => {
    const isFav = favoritedIds.has(article.id);
    const isRead = readIds.has(article.id);
    return (
      <div key={article.id} onClick={() => handleArticleClick(article)} style={{
        backgroundColor: cardBg, borderRadius: '10px', overflow: 'hidden',
        border: `1px solid ${border}`, boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
        cursor: 'pointer', position: 'relative', opacity: isRead ? 0.65 : 1,
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)'; }}
      onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)'; }}
      >
        {isRead && <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 2, backgroundColor: '#28a745', borderRadius: '6px', padding: '0.15rem 0.4rem', fontSize: '0.7rem', color: 'white', fontWeight: '600' }}>✓ Read</div>}
        {article.imageUrl
          ? <img src={article.imageUrl} alt="" style={{ width: '100%', height: '150px', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '60px', backgroundColor: isDarkMode ? '#333' : '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaRss style={{ color: '#FF6B35', opacity: 0.3, fontSize: '1.2rem' }} /></div>
        }
        <div style={{ padding: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', fontSize: '0.78rem', color: textSecondary }}>
            {getFeedFavicon(article.feedTitle) && <img src={getFeedFavicon(article.feedTitle)} alt="" style={{ width: '13px', height: '13px', borderRadius: '2px' }} onError={e => e.target.style.display = 'none'} />}
            <span style={{ color: textSecondary, fontWeight: '600' }}>{article.feedTitle || 'Feed'}</span>
            <span>·</span><span>{getRelativeTime(article.publishedAt)}</span>
          </div>
          <h3 style={{ color: textPrimary, fontSize: '0.92rem', fontWeight: '600', lineHeight: '1.4', margin: '0 0 0.4rem', textAlign: 'left', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{stripHtml(article.title)}</h3>
          {article.description && <p style={{ color: textSecondary, fontSize: '0.8rem', lineHeight: '1.5', margin: '0 0 0.75rem', textAlign: 'left', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: article.description }} />}
          
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
            <button onClick={e => handleToggleFavoriteById(e, article)} style={{ padding: '0.25rem 0.6rem', backgroundColor: isFav ? 'transparent' : 'transparent', color: isFav ? '#FFD700' : textSecondary, border: `1px solid ${isFav ? '#FFD700' : border}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <FaStar /> {isFav ? 'Favorited' : 'Favorite'}
            </button>
            <button onClick={e => { e.stopPropagation(); handleRemove(article.id); }} style={{ padding: '0.25rem 0.6rem', backgroundColor: 'transparent', color: textSecondary, border: `1px solid ${border}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <FaTrash /> Remove
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderListRow = (article, idx, total) => {
    const isFav = favoritedIds.has(article.id);
    const isRead = readIds.has(article.id);
    return (
      <div key={article.id} onClick={() => handleArticleClick(article)} style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 1rem',
        borderBottom: idx < total - 1 ? `1px solid ${border}` : 'none',
        cursor: 'pointer', opacity: isRead ? 0.6 : 1,
      }}
      onMouseOver={e => { e.currentTarget.style.backgroundColor = isDarkMode ? '#333' : '#f9f9f9'; }}
      onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <button onClick={e => handleToggleFavoriteById(e, article)} title={isFav ? 'Favoritesから削除' : 'Favoritesに追加'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: isFav ? '#FFD700' : textSecondary, fontSize: '0.9rem', flexShrink: 0 }}><FaStar /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '5em', flexShrink: 0, overflow: 'hidden' }}>
          {getFeedFavicon(article.feedTitle) ? <img src={getFeedFavicon(article.feedTitle)} alt="" style={{ width: '14px', height: '14px', borderRadius: '2px', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} /> : <FaRss style={{ fontSize: '0.75rem', color: '#FF6B35', flexShrink: 0 }} />}
          <span style={{ color: textSecondary, fontSize: '0.82rem', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{article.feedTitle || 'Feed'}</span>
        </div>
        <span style={{ color: textPrimary, fontSize: '0.9rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{stripHtml(article.title)}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, fontSize: '0.8rem', color: textSecondary }}>
          {isRead && <span style={{ color: '#28a745' }}>✓</span>}
          <span>{getRelativeTime(article.publishedAt)}</span>
          <button onClick={e => { e.stopPropagation(); handleRemove(article.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textSecondary, fontSize: '0.85rem', flexShrink: 0, padding: '2px 4px', marginLeft: '0.5rem' }}><FaTrash /></button>
        </div>
      </div>
    );
  };

  const renderMagazineRow = (article, idx, total) => {
    const isFav = favoritedIds.has(article.id);
    const isRead = readIds.has(article.id);
    return (
      <div key={article.id} onClick={() => handleArticleClick(article)} style={{
        display: 'flex', gap: '1rem', padding: '1rem',
        borderBottom: idx < total - 1 ? `1px solid ${border}` : 'none',
        cursor: 'pointer', opacity: isRead ? 0.65 : 1, alignItems: 'flex-start',
      }}
      onMouseOver={e => { e.currentTarget.style.backgroundColor = isDarkMode ? '#333' : '#f5f5f5'; }}
      onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        {article.imageUrl
          ? <img src={article.imageUrl} alt="" style={{ width: '160px', height: '110px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
          : <div style={{ width: '160px', height: '110px', backgroundColor: isDarkMode ? '#333' : '#eee', borderRadius: '8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaRss style={{ color: '#FF6B35', opacity: 0.3, fontSize: '1.5rem' }} /></div>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', fontSize: '0.8rem', color: textSecondary }}>
            {getFeedFavicon(article.feedTitle) && <img src={getFeedFavicon(article.feedTitle)} alt="" style={{ width: '14px', height: '14px', borderRadius: '2px' }} onError={e => e.target.style.display = 'none'} />}
            <span style={{ color: textSecondary, fontWeight: '600' }}>{article.feedTitle || 'Feed'}</span>
            <span>·</span><span>{getRelativeTime(article.publishedAt)}</span>
            {isRead && <span style={{ color: '#28a745' }}>✓ Read</span>}
          </div>
          <h3 style={{ color: textPrimary, fontSize: '1rem', fontWeight: '700', lineHeight: '1.5', margin: '0 0 0.5rem', textAlign: 'left' }}>{stripHtml(article.title)}</h3>
          {article.description && <p style={{ color: textSecondary, fontSize: '0.85rem', lineHeight: '1.6', margin: '0 0 0.6rem', textAlign: 'left', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: article.description }} />}
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={e => handleToggleFavoriteById(e, article)} style={{ padding: '0.2rem 0.55rem', backgroundColor: 'transparent', color: isFav ? '#FFD700' : textSecondary, border: `1px solid ${isFav ? '#FFD700' : border}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <FaStar /> {isFav ? 'Favorited' : 'Favorite'}
            </button>
            <button onClick={e => { e.stopPropagation(); handleRemove(article.id); }} style={{ padding: '0.2rem 0.55rem', backgroundColor: 'transparent', color: textSecondary, border: `1px solid ${border}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <FaTrash /> Remove
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderArticlesByMode = (artList) => {
    if (viewMode === 'card') return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {artList.map(a => renderCard(a))}
      </div>
    );
    if (viewMode === 'list') return (
      <div style={{ backgroundColor: cardBg, borderRadius: '10px', border: `1px solid ${border}`, overflow: 'hidden' }}>
        {artList.map((a, i) => renderListRow(a, i, artList.length))}
      </div>
    );
    return (
      <div style={{ backgroundColor: cardBg, borderRadius: '10px', border: `1px solid ${border}`, overflow: 'hidden' }}>
        {artList.map((a, i) => renderMagazineRow(a, i, artList.length))}
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: bg }}>
      <Navigation />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FaBookmark style={{ color: '#FF6B35', fontSize: '1.4rem' }} />
            <h1 style={{ color: textPrimary, fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>Read Later</h1>
            <span style={{ backgroundColor: '#FF6B35', color: 'white', borderRadius: '12px', padding: '0.15rem 0.6rem', fontSize: '0.82rem', fontWeight: '700' }}>{articles.length}</span>
            {readCount > 0 && <span style={{ color: textSecondary, fontSize: '0.82rem' }}>({readCount}件既読 · Refreshで消去)</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={handleRefresh} disabled={refreshing || loading} style={{ padding: '0.35rem 0.9rem', backgroundColor: '#FF6B35', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem', opacity: (refreshing || loading) ? 0.7 : 1 }}>
              <FaSync style={{ animation: (refreshing || loading) ? 'spin 1s linear infinite' : 'none' }} /> Refresh
            </button>
            <button onClick={cycleViewMode} style={{ padding: '0.35rem 0.9rem', border: `1px solid ${border}`, borderRadius: '20px', backgroundColor: 'transparent', color: textSecondary, cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {viewModeLabel}
            </button>
          </div>
        </div>

        {SHOW_IMPORT_FORM && (
          <div style={{ backgroundColor: cardBg, border: `1px solid ${border}`, borderRadius: '10px', padding: '1rem', marginBottom: '1.5rem' }}>
            <p style={{ color: textSecondary, fontSize: '0.82rem', fontWeight: '700', margin: '0 0 0.75rem' }}>📥 移管用インポート</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input placeholder="タイトル *" value={importForm.title} onChange={e => setImportForm(p => ({ ...p, title: e.target.value }))}
                style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: `1px solid ${border}`, backgroundColor: isDarkMode ? '#333' : '#fff', color: textPrimary, fontSize: '0.9rem' }} />
              <input placeholder="URL *" value={importForm.url} onChange={e => setImportForm(p => ({ ...p, url: e.target.value }))}
                style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: `1px solid ${border}`, backgroundColor: isDarkMode ? '#333' : '#fff', color: textPrimary, fontSize: '0.9rem' }} />
              <input placeholder="フィード名（任意）" value={importForm.feedTitle} onChange={e => setImportForm(p => ({ ...p, feedTitle: e.target.value }))}
                style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: `1px solid ${border}`, backgroundColor: isDarkMode ? '#333' : '#fff', color: textPrimary, fontSize: '0.9rem' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button onClick={handleImport} disabled={importing}
                  style={{ padding: '0.4rem 1rem', backgroundColor: '#FF6B35', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', opacity: importing ? 0.7 : 1 }}>
                  {importing ? '追加中...' : '追加'}
                </button>
                {importMsg && <span style={{ fontSize: '0.82rem', color: importMsg.type === 'success' ? '#28a745' : '#dc3545' }}>{importMsg.text}</span>}
              </div>
            </div>
          </div>
        )}

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

        {/* ★ カテゴリごとのレンダリング (Dashboardと同じロジック) */}
        {!loading && !refreshing && articles.length > 0 && useCategoryGroups && groupedArticles.map(([cat, artList]) => (
          <div key={cat} style={{ marginBottom: '2rem' }}>
            {/* ★ ここがオレンジの帯だよ！ */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: `2px solid ${isDarkMode ? '#444' : '#e0e0e0'}`, borderLeft: '4px solid #FF6B35', paddingLeft: '0.5rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: '700', color: textSecondary, textAlign: 'left' }}>
                {cat === '__uncategorized__' ? 'Others' : cat}
              </span>
              <span style={{ fontSize: '0.78rem', color: textSecondary }}>{artList.length}件</span>
            </div>
            {renderArticlesByMode(artList)}
          </div>
        ))}

        {/* カテゴリがない（全て未分類など）の場合はフラットに表示 */}
        {!loading && !refreshing && articles.length > 0 && !useCategoryGroups && renderArticlesByMode(articles)}

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
