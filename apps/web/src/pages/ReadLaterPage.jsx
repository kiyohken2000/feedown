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

  const bg = isDarkMode ? '#1a1a1a' : '#f0f0f0';
  const cardBg = isDarkMode ? '#2d2d2d' : '#ffffff';
  const border = isDarkMode ? '#444' : '#e0e0e0';
  const textPrimary = isDarkMode ? '#e0e0e0' : '#222';
  const textSecondary = isDarkMode ? '#aaa' : '#888';

  const apiClient = useMemo(
    () => createApiClient(import.meta.env.VITE_API_BASE_URL || '', getAccessToken),
    []
  );
  const api = useMemo(() => new FeedOwnAPI(apiClient), [apiClient]);

  const callReadLaterAPI = useCallback(async (method, body = null, query = '') => {
    const token = await getAccessToken();
    const res = await fetch(`/api/read-later${query}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
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
    } catch {
      setError('Failed to load Read Later articles.');
    } finally {
      setLoading(false);
    }
  }, [callReadLaterAPI]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const data = await callReadLaterAPI('GET');
      console.log('Refresh response:', data);
      if (data.success) {
        setArticles(data.data.articles || []);
        setReadIds(new Set());
      }
    } catch {
      setError('Failed to refresh.');
    } finally {
      setRefreshing(false);
    }
  }, [callReadLaterAPI]);

  const fetchFavorites = useCallback(async () => {
    try {
      const res = await api.favorites.list();
      if (res.success) {
        setFavoritedIds(new Set(res.data.favorites.map(f => f.articleId)));
      }
    } catch (e) {
      console.error(e);
    }
  }, [api]);

  useEffect(() => {
    fetchArticles();
    fetchFavorites();
  }, [fetchArticles, fetchFavorites]);

  const handleRemove = async articleId => {
    try {
      await callReadLaterAPI('DELETE', null, `?articleId=${encodeURIComponent(articleId)}`);
      setArticles(prev => prev.filter(a => a.article_id !== articleId));
      if (selectedArticle?.id === articleId) setSelectedArticle(null);
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
      const articleId = crypto.randomUUID();
      const body = { articleId, title: importForm.title, url: importForm.url, feedTitle: importForm.feedTitle };
      console.log('Sending:', body);  // ← 追加
      const data = await callReadLaterAPI('POST', body);
      console.log('Response:', data);  // ← 追加
      if (data.success) {
        setImportMsg({ type: 'success', text: '追加しました' });
        setImportForm({ title: '', url: '', feedTitle: '' });
        await handleRefresh();
      } else {
        setImportMsg({ type: 'error', text: data.error || '失敗しました' });
      }
    } catch (e) {
      console.error('Import error:', e);
      setImportMsg({ type: 'error', text: '失敗しました: ' + e.message });
    } finally { setImporting(false); }
  };

  const handleArticleClick = useCallback(
    article => {
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
      callReadLaterAPI(
        'DELETE',
        null,
        `?articleId=${encodeURIComponent(article.article_id)}`
      ).catch(console.error);
      api.articles.markAsRead(article.article_id).catch(console.error);
    },
    [api, callReadLaterAPI]
  );

  const handleToggleFavorite = useCallback(async () => {
    if (!selectedArticle) return;
    const isFav = favoritedIds.has(selectedArticle.id);
    try {
      if (isFav) {
        await api.articles.removeFromFavorites(selectedArticle.id);
        setFavoritedIds(prev => {
          const s = new Set(prev);
          s.delete(selectedArticle.id);
          return s;
        });
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
    } catch (e) {
      console.error(e);
    }
  }, [selectedArticle, favoritedIds, api]);

  const handleToggleFavoriteById = useCallback(
    async (e, article) => {
      e.stopPropagation();
      const isFav = favoritedIds.has(article.article_id);
      try {
        if (isFav) {
          await api.articles.removeFromFavorites(article.article_id);
          setFavoritedIds(prev => {
            const s = new Set(prev);
            s.delete(article.article_id);
            return s;
          });
        } else {
          await api.articles.addToFavorites(article.article_id, {
            title: article.title,
            url: article.url,
            description: article.description,
            feedTitle: article.feed_title,
            imageUrl: article.image_url,
          });
          setFavoritedIds(prev => new Set([...prev, article.article_id]));
        }
      } catch (e) {
        console.error(e);
      }
    },
    [favoritedIds, api]
  );

  const getRelativeTime = d => {
    if (!d) return '';
    const diff = Math.floor((Date.now() - new Date(d)) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(d).toLocaleDateString();
  };

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

  const readCount = readIds.size;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: bg }}>
      <Navigation />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' }}>
        {/* ヘッダー */}
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
            <FaBookmark style={{ color: '#FF6B35', fontSize: '1.4rem' }} />
            <h1
              style={{
                color: textPrimary,
                fontSize: '1.5rem',
                fontWeight: '700',
                margin: 0,
              }}
            >
              Read Later
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
                padding: '0.35rem 0.9rem',
                backgroundColor: '#FF6B35',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                opacity: refreshing || loading ? 0.7 : 1,
              }}
            >
              <FaSync
                style={{
                  animation: refreshing || loading ? 'spin 1s linear infinite' : 'none',
                }}
              />{' '}
              Refresh
            </button>
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
        </div>

        {/* インポートフォーム */}
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
                        importMsg.type === 'success'
                          ? '#28a745'
                          : '#dc3545',
                    }}
                  >
                    {importMsg.text}
                  </span>
                )}
              </div>
            </div>
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
