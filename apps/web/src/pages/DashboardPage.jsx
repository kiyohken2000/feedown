import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { FaCheck, FaSync, FaArrowUp, FaList, FaTh, FaRss, FaThumbtack, FaBookmark, FaNewspaper } from 'react-icons/fa';
import { supabase, getAccessToken } from '../lib/supabase';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';
import Navigation from '../components/Navigation';
import ArticleModal from '../components/ArticleModal';
import { useTheme } from '../contexts/ThemeContext';
import { useArticles } from '../contexts/ArticlesContext';
import { usePersistedState } from '../hooks/usePersistedState';

// ── カテゴリサイドバーセクション（初期折りたたみ） ──
const CategorySection = ({ label, feedList, feedUnreadCounts, selectedFeedId, setSelectedFeedId, textPrimary, textSecondary, isDarkMode }) => {
  const [collapsed, setCollapsed] = useState(true); // 初期は折りたたみ
  const categoryUnread = feedList.reduce((sum, f) => sum + (feedUnreadCounts[f.id] || 0), 0);
  return (
    <div>
      <div onClick={() => setCollapsed(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        padding: '0.3rem 1rem', cursor: 'pointer',
        fontSize: '0.72rem', fontWeight: '700',
        color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', userSelect: 'none',
      }}>
        <span style={{ fontSize: '0.65rem' }}>{collapsed ? '▶' : '▼'}</span>
        <span style={{ flex: 1 }}>{label}</span>
        {/* モノトーンバッジ */}
        {categoryUnread > 0 && (
          <span style={{ backgroundColor: isDarkMode ? '#555' : '#bbb', color: isDarkMode ? '#eee' : '#fff', borderRadius: '12px', padding: '0.1rem 0.4rem', fontSize: '0.7rem', fontWeight: '700' }}>
            {categoryUnread}
          </span>
        )}
      </div>
      {!collapsed && feedList.map(feed => {
        const unread = feedUnreadCounts[feed.id] || 0;
        const isActive = selectedFeedId === feed.id;
        return (
          <div key={feed.id} onClick={() => setSelectedFeedId(feed.id)} style={{
            padding: '0.5rem 1rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            backgroundColor: isActive ? (isDarkMode ? '#444' : '#555') : 'transparent',
            color: isActive ? 'white' : textPrimary,
            borderRadius: '6px', margin: '0.1rem 0.5rem',
            fontSize: '0.87rem', whiteSpace: 'nowrap', overflow: 'hidden',
          }}
          onMouseOver={e => { if (!isActive) e.currentTarget.style.backgroundColor = isDarkMode ? '#333' : '#eee'; }}
          onMouseOut={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            {feed.faviconUrl
              ? <img src={feed.faviconUrl} alt="" style={{ width: '16px', height: '16px', borderRadius: '3px', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
              : <FaRss style={{ flexShrink: 0, fontSize: '0.8rem', opacity: 0.5 }} />
            }
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{feed.title || feed.url}</span>
            {unread > 0 && (
              <span style={{ backgroundColor: isActive ? 'white' : (isDarkMode ? '#555' : '#bbb'), color: isActive ? (isDarkMode ? '#444' : '#555') : (isDarkMode ? '#eee' : '#fff'), borderRadius: '12px', padding: '0.1rem 0.4rem', fontSize: '0.72rem', fontWeight: '700', flexShrink: 0 }}>{unread}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

const DashboardPage = () => {
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [articlesError, setArticlesError] = useState(null);
  const [filter, setFilter] = usePersistedState('dashboard_filter', 'all');
  const [selectedFeedId, setSelectedFeedId] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewMode, setViewMode] = usePersistedState('dashboard_viewMode', 'card'); // 'card' | 'list' | 'magazine'
  const [checkedArticles, setCheckedArticles] = useState(new Set());
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [readLaterArticles, setReadLaterArticles] = useState(new Set());
  const [swipeToast, setSwipeToast] = useState(null);
  const sidebarOpen = sidebarPinned || sidebarHovered;
  const hoverTimeoutRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  const location = useLocation();
  const { isDarkMode } = useTheme();
  const {
    articles, setArticles, readArticles, setReadArticles,
    favoritedArticles, setFavoritedArticles,
    feeds, setFeeds, lastArticleFetchTime, setLastArticleFetchTime, hasMore, setHasMore,
  } = useArticles();

  const observerRef = useRef(null);
  const articleRefs = useRef({});
  const loadMoreRef = useRef(null);
  const loadMoreObserverRef = useRef(null);
  const fullyViewedArticles = useRef(new Set());
  const handleRefreshRef = useRef(null);

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

  const fetchReadLater = useCallback(async () => {
    try {
      const data = await callReadLaterAPI('GET');
      if (data.success) setReadLaterArticles(new Set(data.data.articles.map(a => a.article_id)));
    } catch (e) { console.error(e); }
  }, [callReadLaterAPI]);

  useEffect(() => { fetchReadLater(); }, [fetchReadLater]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escキーが押されて、かつ記事ポップアップが表示中なら閉じる
      if (e.key === 'Escape' && selectedArticle) {
        setSelectedArticle(null);
      }
    };

    // イベントリスナーを登録
    window.addEventListener('keydown', handleKeyDown);
    
    // クリーンアップ関数（コンポーネントが破棄されるか、selectedArticleが変わった時に古いリスナーを消す）
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedArticle]);

  const showToast = (msg, type = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setSwipeToast({ msg, type });
    toastTimeoutRef.current = setTimeout(() => setSwipeToast(null), 2000);
  };

  const handleAddToReadLater = useCallback(async (article) => {
    try {
      await callReadLaterAPI('POST', {
        articleId: article.id, title: article.title, url: article.url,
        description: article.description, feedTitle: article.feedTitle, imageUrl: article.imageUrl,
      });
      setReadLaterArticles(prev => new Set([...prev, article.id]));
      showToast('📌 Read Laterに追加しました');
    } catch (e) { showToast('エラーが発生しました', 'error'); }
  }, [callReadLaterAPI]);

  const handleRemoveFromReadLater = useCallback(async (articleId) => {
    try {
      await callReadLaterAPI('DELETE', null, `?articleId=${encodeURIComponent(articleId)}`);
      setReadLaterArticles(prev => { const s = new Set(prev); s.delete(articleId); return s; });
      showToast('Read Laterから削除しました');
    } catch (e) { console.error(e); }
  }, [callReadLaterAPI]);

  const handleBatchAddToReadLater = useCallback(async () => {
    for (const id of [...checkedArticles]) {
      const article = articles.find(a => a.id === id);
      if (article) await handleAddToReadLater(article);
    }
    setCheckedArticles(new Set());
  }, [checkedArticles, articles, handleAddToReadLater]);

  const markAsRead = useCallback(async (articleId) => {
    setReadArticles(prev => new Set([...prev, articleId]));
    try { await api.articles.markAsRead(articleId); } catch (e) { console.error(e); }
  }, [api, setReadArticles]);

  const fetchFeeds = useCallback(async () => {
    try {
      const res = await api.feeds.list();
      if (res.success) {
        let feedsData = res.data.feeds || [];
        const { data: catData } = await supabase.from('feeds').select('id, category');
        if (catData) {
          const catMap = {};
          catData.forEach(f => { catMap[f.id] = f.category; });
          feedsData = feedsData.map(f => ({ ...f, category: catMap[f.id] || null }));
        }
        setFeeds(feedsData);
      }
    } catch (e) { console.error(e); }
  }, [api]);

  const fetchArticles = useCallback(async (reset = true, feedId = null) => {
    if (reset) { setArticlesLoading(true); setHasMore(true); }
    else setLoadingMore(true);
    setArticlesError(null);
    try {
      const offset = reset ? 0 : articles.length;
      const limit = 50;
      const res = await api.articles.list({ limit, offset, feedId: feedId || undefined });
      if (res.success) {
        const newArticles = res.data.articles || [];
        const hasMoreData = res.data.hasMore ?? (newArticles.length === limit);
        if (reset) setArticles(newArticles); else setArticles(prev => [...prev, ...newArticles]);
        setHasMore(hasMoreData);
        const readSet = reset ? new Set() : new Set(readArticles);
        newArticles.forEach(a => { if (a.isRead) readSet.add(a.id); });
        setReadArticles(readSet);
        if (reset) setLastArticleFetchTime(Date.now());
      } else throw new Error(res.error);
    } catch (e) {
      setArticlesError('Failed to load articles.');
    } finally {
      if (reset) setArticlesLoading(false); else setLoadingMore(false);
    }
  }, [api, articles.length]);

  const handleRefresh = useCallback(async () => {
    setArticlesLoading(true);
    try {
      let offset = 0, latestFeeds = null;
      while (true) {
        const r = await api.refresh.refreshAll(offset || undefined);
        if (!r.success) break;
        if (r.data.feeds) latestFeeds = r.data.feeds;
        if (!r.data.remaining || r.data.remaining <= 0 || !r.data.nextOffset) break;
        offset = r.data.nextOffset;
      }
      if (latestFeeds) {
        const { data: catData } = await supabase.from('feeds').select('id, category');
        if (catData) {
          const catMap = {};
          catData.forEach(f => { catMap[f.id] = f.category; });
          latestFeeds = latestFeeds.map(f => ({ ...f, category: catMap[f.id] || null }));
        }
        setFeeds(latestFeeds);
      } else await fetchFeeds();
      await fetchArticles(true, selectedFeedId);
    } catch (e) {
      setArticlesError('Failed to refresh feeds.');
      setArticlesLoading(false);
    }
  }, [api, fetchFeeds, fetchArticles, setFeeds, selectedFeedId]);

  handleRefreshRef.current = handleRefresh;

  useEffect(() => {
    fetchFeeds();
    fetchArticles(true, selectedFeedId);
  }, [location.key]);

  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (location.pathname === '/dashboard' && prevPathRef.current !== '/dashboard') {
      fetchFeeds(); fetchArticles(true, selectedFeedId);
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') { fetchFeeds(); fetchArticles(true, selectedFeedId); }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [fetchArticles, selectedFeedId]);

  useEffect(() => {
    const id = setInterval(() => {
      if (lastArticleFetchTime && Date.now() - lastArticleFetchTime >= 15 * 60 * 1000)
        fetchArticles(true, selectedFeedId);
    }, 60 * 1000);
    return () => clearInterval(id);
  }, [lastArticleFetchTime]);

  const unreadCount = useMemo(() => articles.filter(a => !readArticles.has(a.id)).length, [articles, readArticles]);
  const feedUnreadCounts = useMemo(() => {
    const counts = {};
    articles.forEach(a => { if (!readArticles.has(a.id)) counts[a.feedId] = (counts[a.feedId] || 0) + 1; });
    return counts;
  }, [articles, readArticles]);

  useEffect(() => {
    if (filter === 'all') setFilteredArticles(articles);
    else if (filter === 'unread') setFilteredArticles(articles.filter(a => !readArticles.has(a.id)));
    else setFilteredArticles(articles.filter(a => readArticles.has(a.id)));
  }, [articles, filter, readArticles]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [filter]);

  const prevFeedIdRef = useRef(selectedFeedId);
  useEffect(() => {
    if (prevFeedIdRef.current !== selectedFeedId) {
      fetchArticles(true, selectedFeedId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    prevFeedIdRef.current = selectedFeedId;
  }, [selectedFeedId, fetchArticles]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    if (filter === 'unread') return;
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const id = entry.target.dataset.articleId;
        if (!id || readArticles.has(id)) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 1.0) fullyViewedArticles.current.add(id);
        if (entry.isIntersecting && entry.intersectionRatio <= 0.5 && fullyViewedArticles.current.has(id)) {
          fullyViewedArticles.current.delete(id); markAsRead(id);
        }
        if (!entry.isIntersecting && fullyViewedArticles.current.has(id)) {
          fullyViewedArticles.current.delete(id); markAsRead(id);
        }
      });
    }, { threshold: [0, 0.5, 1.0] });
    Object.values(articleRefs.current).forEach(ref => { if (ref) observerRef.current.observe(ref); });
    return () => { if (observerRef.current) observerRef.current.disconnect(); };
  }, [filteredArticles, readArticles, markAsRead, filter]);

  useEffect(() => {
    if (loadMoreObserverRef.current) loadMoreObserverRef.current.disconnect();
    loadMoreObserverRef.current = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore && !loadingMore && !articlesLoading)
        fetchArticles(false, selectedFeedId);
    }, { threshold: 0.1 });
    if (loadMoreRef.current) loadMoreObserverRef.current.observe(loadMoreRef.current);
    return () => { if (loadMoreObserverRef.current) loadMoreObserverRef.current.disconnect(); };
  }, [hasMore, loadingMore, articlesLoading, selectedFeedId]);

  const handleMarkAllAsRead = async () => {
    if (articlesLoading) return;
    const ids = articles.filter(a => !readArticles.has(a.id)).map(a => a.id);
    if (!ids.length) return;
    setReadArticles(prev => { const s = new Set(prev); ids.forEach(id => s.add(id)); return s; });
    try { await api.articles.batchMarkAsRead(ids); await fetchArticles(true, selectedFeedId); }
    catch (e) { setReadArticles(prev => { const s = new Set(prev); ids.forEach(id => s.delete(id)); return s; }); }
  };

  const handleMarkCheckedAsRead = async () => {
    if (!checkedArticles.size) return;
    const ids = [...checkedArticles];
    setReadArticles(prev => { const s = new Set(prev); ids.forEach(id => s.add(id)); return s; });
    setCheckedArticles(new Set());
    try { await api.articles.batchMarkAsRead(ids); } catch (e) { console.error(e); }
  };

  const handleCheckboxChange = (e, articleId) => {
    e.stopPropagation();
    setCheckedArticles(prev => { const s = new Set(prev); s.has(articleId) ? s.delete(articleId) : s.add(articleId); return s; });
  };

  const handleSelectAll = () => {
    if (checkedArticles.size === filteredArticles.length) setCheckedArticles(new Set());
    else setCheckedArticles(new Set(filteredArticles.map(a => a.id)));
  };

  const allChecked = filteredArticles.length > 0 && checkedArticles.size === filteredArticles.length;
  const someChecked = checkedArticles.size > 0 && checkedArticles.size < filteredArticles.length;

  const handleArticleClick = (article) => {
    setSelectedArticle(article);
    if (!readArticles.has(article.id)) markAsRead(article.id);
  };

  const handleToggleFavorite = async () => {
    if (!selectedArticle) return;
    try {
      if (favoritedArticles.has(selectedArticle.id)) {
        await api.articles.removeFromFavorites(selectedArticle.id);
        setFavoritedArticles(prev => { const s = new Set(prev); s.delete(selectedArticle.id); return s; });
      } else {
        await api.articles.addToFavorites(selectedArticle.id, {
          title: selectedArticle.title, url: selectedArticle.url,
          description: selectedArticle.description, feedTitle: selectedArticle.feedTitle, imageUrl: selectedArticle.imageUrl,
        });
        setFavoritedArticles(prev => new Set([...prev, selectedArticle.id]));
      }
    } catch (e) { console.error(e); }
  };

  const getRelativeTime = (d) => {
    if (!d) return '';
    const diff = Math.floor((Date.now() - new Date(d)) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return new Date(d).toLocaleDateString();
  };

  const stripHtml = (html) => html?.replace(/<[^>]*>/g, '') || '';

  const getFeedFavicon = (feedId) => feeds.find(f => f.id === feedId)?.faviconUrl || null;
  const getFeedCategory = useCallback((feedId) => feeds.find(f => f.id === feedId)?.category || null, [feeds]);

  const touchStartX = useRef({});
  const handleTouchStart = (e, articleId) => { touchStartX.current[articleId] = e.touches[0].clientX; };
  const handleTouchEnd = (e, article) => {
    const startX = touchStartX.current[article.id];
    if (startX === undefined) return;
    const delta = e.changedTouches[0].clientX - startX;
    if (Math.abs(delta) > 60) {
      if (delta > 0) { markAsRead(article.id); showToast('✓ 既読にしました'); }
      else { readLaterArticles.has(article.id) ? handleRemoveFromReadLater(article.id) : handleAddToReadLater(article); }
    }
    delete touchStartX.current[article.id];
  };

  const bg = isDarkMode ? '#1a1a1a' : '#f0f0f0';
  const cardBg = isDarkMode ? '#2d2d2d' : '#ffffff';
  const border = isDarkMode ? '#444' : '#e0e0e0';
  const textPrimary = isDarkMode ? '#e0e0e0' : '#222';
  const textSecondary = isDarkMode ? '#aaa' : '#888';
  const sidebarBg = isDarkMode ? '#242424' : '#fafafa';

  const handleSidebarMouseEnter = () => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); setSidebarHovered(true); };
  const handleSidebarMouseLeave = () => { if (!sidebarPinned) hoverTimeoutRef.current = setTimeout(() => setSidebarHovered(false), 300); };

  const { grouped, noCategory } = useMemo(() => {
    const grouped = {};
    const noCategory = [];
    feeds.forEach(feed => {
      if (feed.category) {
        if (!grouped[feed.category]) grouped[feed.category] = [];
        grouped[feed.category].push(feed);
      } else noCategory.push(feed);
    });
    return { grouped, noCategory };
  }, [feeds]);
  const hasCategories = Object.keys(grouped).length > 0;
  const categorySectionProps = { feedUnreadCounts, selectedFeedId, setSelectedFeedId, textPrimary, textSecondary, isDarkMode };

  // 記事カテゴリグループ
  const groupedArticles = useMemo(() => {
    if (!filteredArticles.length) return [];
    const catMap = {};
    const uncategorized = [];
    filteredArticles.forEach(article => {
      const cat = getFeedCategory(article.feedId);
      if (cat) { if (!catMap[cat]) catMap[cat] = []; catMap[cat].push(article); }
      else uncategorized.push(article);
    });
    const sorted = Object.entries(catMap).sort(([a], [b]) => a.localeCompare(b, 'ja'));
    if (uncategorized.length > 0) sorted.push(['__uncategorized__', uncategorized]);
    return sorted;
  }, [filteredArticles, feeds, getFeedCategory]);

  const useCategoryGroups = useMemo(() =>
    groupedArticles.length > 1 || (groupedArticles.length === 1 && groupedArticles[0][0] !== '__uncategorized__'),
    [groupedArticles]
  );

  // ビュー切替（card → list → magazine）
  const cycleViewMode = () => {
    setViewMode(v => v === 'card' ? 'list' : v === 'list' ? 'magazine' : 'card');
  };
  const viewModeLabel = viewMode === 'card' ? <><FaList /> List</> : viewMode === 'list' ? <><FaNewspaper /> Magazine</> : <><FaTh /> Card</>;

  // ── 記事レンダラー ──

  const renderCard = (article) => {
    const isRead = readArticles.has(article.id);
    const isChecked = checkedArticles.has(article.id);
    const isReadLater = readLaterArticles.has(article.id);
    return (
      <div key={article.id} ref={el => articleRefs.current[article.id] = el} data-article-id={article.id}
        onClick={() => handleArticleClick(article)}
        onTouchStart={e => handleTouchStart(e, article.id)}
        onTouchEnd={e => handleTouchEnd(e, article)}
        style={{
          backgroundColor: cardBg, borderRadius: '10px', overflow: 'hidden',
          boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
          border: isChecked ? '2px solid #FF6B35' : `1px solid ${border}`,
          cursor: 'pointer', opacity: isRead ? 0.65 : 1,
          transition: 'transform 0.2s, box-shadow 0.2s', position: 'relative',
        }}
        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)'; }}
        onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isDarkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)'; }}
      >
        <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 2 }}>
          <input type="checkbox" checked={isChecked} onChange={e => handleCheckboxChange(e, article.id)} onClick={e => e.stopPropagation()}
            style={{ width: '16px', height: '16px', accentColor: '#FF6B35', cursor: 'pointer' }} />
        </div>
        {isReadLater && (
          <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 2, backgroundColor: '#6f42c1', borderRadius: '6px', padding: '0.2rem 0.4rem' }}>
            <FaBookmark style={{ color: 'white', fontSize: '0.7rem' }} />
          </div>
        )}
        {article.imageUrl
          ? <img src={article.imageUrl} alt="" style={{ width: '100%', height: '150px', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '60px', backgroundColor: isDarkMode ? '#333' : '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FaRss style={{ color: '#FF6B35', opacity: 0.3, fontSize: '1.2rem' }} />
            </div>
        }
        <div style={{ padding: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', fontSize: '0.78rem', color: textSecondary }}>
            {getFeedFavicon(article.feedId) && <img src={getFeedFavicon(article.feedId)} alt="" style={{ width: '13px', height: '13px', borderRadius: '2px' }} onError={e => e.target.style.display = 'none'} />}
            <span style={{ color: textSecondary, fontWeight: '600' }}>{article.feedTitle || 'Feed'}</span>
            <span>·</span>
            <span>{getRelativeTime(article.publishedAt)}</span>
            {isRead && <span style={{ color: '#28a745', marginLeft: 'auto' }}>✓</span>}
          </div>
          <h3 style={{ color: textPrimary, fontSize: '0.92rem', fontWeight: '600', lineHeight: '1.4', margin: '0 0 0.4rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', textAlign: 'left' }}>
            {stripHtml(article.title)}
          </h3>
          {article.description && (
            <p style={{ color: textSecondary, fontSize: '0.8rem', lineHeight: '1.5', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textAlign: 'left' }}
              dangerouslySetInnerHTML={{ __html: article.description }} />   
          )}
          <button onClick={e => { e.stopPropagation(); isReadLater ? handleRemoveFromReadLater(article.id) : handleAddToReadLater(article); }}
            style={{
              marginTop: '0.6rem', padding: '0.25rem 0.6rem',
              backgroundColor: isReadLater ? '#6f42c1' : 'transparent',
              color: isReadLater ? 'white' : textSecondary,
              border: `1px solid ${isReadLater ? '#6f42c1' : border}`,
              borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem',
              display: 'flex', alignItems: 'center', gap: '0.3rem',
            }}
          >
            <FaBookmark /> {isReadLater ? 'Read Later ✓' : 'Read Later'}
          </button>
        </div>
      </div>
    );
  };

  const renderListRow = (article, idx, total) => {
    const isRead = readArticles.has(article.id);
    const isChecked = checkedArticles.has(article.id);
    const isReadLater = readLaterArticles.has(article.id);
    return (
      <div key={article.id} ref={el => articleRefs.current[article.id] = el} data-article-id={article.id}
        onClick={() => handleArticleClick(article)}
        onTouchStart={e => handleTouchStart(e, article.id)}
        onTouchEnd={e => handleTouchEnd(e, article)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.65rem 1rem',
          borderBottom: idx < total - 1 ? `1px solid ${border}` : 'none',
          cursor: 'pointer', opacity: isRead ? 0.6 : 1,
          backgroundColor: isChecked ? (isDarkMode ? '#3a3a2a' : '#fffbe6') : 'transparent',
        }}
        onMouseOver={e => { e.currentTarget.style.backgroundColor = isDarkMode ? '#333' : '#f9f9f9'; }}
        onMouseOut={e => { e.currentTarget.style.backgroundColor = isChecked ? (isDarkMode ? '#3a3a2a' : '#fffbe6') : 'transparent'; }}
      >
        <input type="checkbox" checked={isChecked} onChange={e => handleCheckboxChange(e, article.id)} onClick={e => e.stopPropagation()}
          style={{ width: '16px', height: '16px', accentColor: '#FF6B35', cursor: 'pointer', flexShrink: 0 }} />
        <button onClick={e => { e.stopPropagation(); isReadLater ? handleRemoveFromReadLater(article.id) : handleAddToReadLater(article); }}
          title={isReadLater ? 'Read Laterから削除' : 'Read Laterに追加'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: isReadLater ? '#6f42c1' : textSecondary, fontSize: '0.85rem', flexShrink: 0 }}>
          <FaBookmark />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '5em', flexShrink: 0, overflow: 'hidden' }}>
          {getFeedFavicon(article.feedId) ? <img src={getFeedFavicon(article.feedId)} alt="" style={{ width: '14px', height: '14px', borderRadius: '2px', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} /> : <FaRss style={{ fontSize: '0.75rem', color: '#FF6B35', flexShrink: 0 }} />}
          <span style={{ color: textSecondary, fontSize: '0.82rem', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
            {article.feedTitle || 'Feed'}
          </span>
        </div>
        <span style={{ color: textPrimary, fontSize: '0.9rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
          {article.title}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, fontSize: '0.8rem', color: textSecondary }}>
          {isReadLater && <FaBookmark style={{ color: '#6f42c1', fontSize: '0.7rem' }} />}
          {isRead && <span style={{ color: '#28a745' }}>✓</span>}
          <span>{getRelativeTime(article.publishedAt)}</span>
        </div>
      </div>
    );
  };

  // マガジンビュー
  const renderMagazineRow = (article, idx, total) => {
    const isRead = readArticles.has(article.id);
    const isChecked = checkedArticles.has(article.id);
    const isReadLater = readLaterArticles.has(article.id);
    return (
      <div key={article.id} ref={el => articleRefs.current[article.id] = el} data-article-id={article.id}
        onClick={() => handleArticleClick(article)}
        onTouchStart={e => handleTouchStart(e, article.id)}
        onTouchEnd={e => handleTouchEnd(e, article)}
        style={{
          display: 'flex', gap: '1rem', padding: '1rem',
          borderBottom: idx < total - 1 ? `1px solid ${border}` : 'none',
          cursor: 'pointer', opacity: isRead ? 0.65 : 1,
          backgroundColor: isChecked ? (isDarkMode ? '#3a3a2a' : '#fffbe6') : 'transparent',
          alignItems: 'flex-start',
        }}
        onMouseOver={e => { e.currentTarget.style.backgroundColor = isDarkMode ? '#333' : '#f5f5f5'; }}
        onMouseOut={e => { e.currentTarget.style.backgroundColor = isChecked ? (isDarkMode ? '#3a3a2a' : '#fffbe6') : 'transparent'; }}
      >
        {/* チェックボックス */}
        <input type="checkbox" checked={isChecked} onChange={e => handleCheckboxChange(e, article.id)} onClick={e => e.stopPropagation()}
          style={{ width: '16px', height: '16px', accentColor: '#FF6B35', cursor: 'pointer', flexShrink: 0, marginTop: '4px' }} />

        {/* サムネイル */}
        {article.imageUrl
          ? <img src={article.imageUrl} alt="" style={{ width: '160px', height: '110px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
          : <div style={{ width: '160px', height: '110px', backgroundColor: isDarkMode ? '#333' : '#eee', borderRadius: '8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FaRss style={{ color: '#FF6B35', opacity: 0.3, fontSize: '1.5rem' }} />
            </div>
        }

        {/* コンテンツ */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', fontSize: '0.8rem', color: textSecondary }}>
            {isReadLater && <FaBookmark style={{ color: '#6f42c1', fontSize: '0.72rem' }} />}
            {getFeedFavicon(article.feedId) && <img src={getFeedFavicon(article.feedId)} alt="" style={{ width: '14px', height: '14px', borderRadius: '2px' }} onError={e => e.target.style.display = 'none'} />}
            <span style={{ color: textSecondary, fontWeight: '600', textAlign: 'left' }}>{article.feedTitle || 'Feed'}</span>
            <span>·</span>
            <span>{getRelativeTime(article.publishedAt)}</span>
            {isRead && <span style={{ color: '#28a745' }}>✓</span>}
          </div>
          <h3 style={{ color: textPrimary, fontSize: '1rem', fontWeight: '700', lineHeight: '1.5', margin: '0 0 0.5rem', textAlign: 'left' }}>
            {stripHtml(article.title)}
          </h3>
          {article.description && (
            <p style={{ color: textSecondary, fontSize: '0.85rem', lineHeight: '1.6', margin: '0 0 0.6rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', textAlign: 'left' }}
              dangerouslySetInnerHTML={{ __html: article.description }} />
          )}
          <button onClick={e => { e.stopPropagation(); isReadLater ? handleRemoveFromReadLater(article.id) : handleAddToReadLater(article); }}
            style={{
              padding: '0.2rem 0.55rem',
              backgroundColor: isReadLater ? '#6f42c1' : 'transparent',
              color: isReadLater ? 'white' : textSecondary,
              border: `1px solid ${isReadLater ? '#6f42c1' : border}`,
              borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem',
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            }}
          >
            <FaBookmark /> {isReadLater ? 'Read Later ✓' : 'Read Later'}
          </button>
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
    // magazine
    return (
      <div style={{ backgroundColor: cardBg, borderRadius: '10px', border: `1px solid ${border}`, overflow: 'hidden' }}>
        {artList.map((a, i) => renderMagazineRow(a, i, artList.length))}
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: bg }}>
      <Navigation unreadCount={unreadCount} />

      {swipeToast && (
        <div style={{
          position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: swipeToast.type === 'error' ? '#dc3545' : '#333',
          color: 'white', padding: '0.6rem 1.5rem', borderRadius: '20px',
          fontSize: '0.9rem', fontWeight: '600', zIndex: 200, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {swipeToast.msg}
        </div>
      )}

      <div style={{ display: 'flex', height: 'calc(100vh - 52px)', position: 'relative' }}>

        {!sidebarOpen && (
          <div onMouseEnter={() => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); setSidebarHovered(true); }}
            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '12px', zIndex: 60, cursor: 'pointer', backgroundColor: isDarkMode ? 'rgba(255,107,53,0.15)' : 'rgba(255,107,53,0.1)', borderRight: '2px solid rgba(255,107,53,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '4px', height: '40px', backgroundColor: 'rgba(255,107,53,0.5)', borderRadius: '2px' }} />
          </div>
        )}

        {/* SIDEBAR */}
        <div onMouseEnter={handleSidebarMouseEnter} onMouseLeave={handleSidebarMouseLeave}
          style={{
            width: sidebarOpen ? '240px' : '0px', minWidth: sidebarOpen ? '240px' : '0px',
            backgroundColor: sidebarBg, borderRight: sidebarOpen ? `1px solid ${border}` : 'none',
            overflowY: sidebarOpen ? 'auto' : 'hidden', overflowX: 'hidden',
            transition: 'width 0.25s ease, min-width 0.25s ease',
            display: 'flex', flexDirection: 'column',
            position: sidebarPinned ? 'relative' : 'absolute',
            left: 0, top: 0, bottom: 0, zIndex: 55,
            boxShadow: !sidebarPinned && sidebarOpen ? '4px 0 12px rgba(0,0,0,0.15)' : 'none',
          }}
        >
          {sidebarOpen && (
            <>
              <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setSidebarPinned(v => !v)} title={sidebarPinned ? 'ピン解除' : '固定'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: sidebarPinned ? '#FF6B35' : textSecondary, fontSize: '0.95rem', padding: '0.25rem', transform: sidebarPinned ? 'rotate(0deg)' : 'rotate(45deg)', transition: 'transform 0.2s, color 0.2s' }}>
                  <FaThumbtack />
                </button>
              </div>

              <div onClick={() => setSelectedFeedId('')} style={{
                padding: '0.6rem 1rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                backgroundColor: selectedFeedId === '' ? (isDarkMode ? '#444' : '#555') : 'transparent',
                color: selectedFeedId === '' ? 'white' : textPrimary,
                borderRadius: '6px', margin: '0 0.5rem',
                fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap',
              }}>
                <FaRss style={{ flexShrink: 0, fontSize: '0.85rem' }} />
                <span style={{ flex: 1 }}>All Feeds</span>
                {/* モノトーンバッジ */}
                {unreadCount > 0 && (
                  <span style={{ backgroundColor: 'rgba(0,0,0,0.22)', color: 'white', borderRadius: '12px', padding: '0.1rem 0.45rem', fontSize: '0.75rem', fontWeight: '700' }}>{unreadCount}</span>
                )}
              </div>

              <div style={{ marginTop: '0.5rem' }}>
                {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b, 'ja')).map(([cat, feedList]) => (
                  <CategorySection key={cat} label={cat} feedList={feedList} {...categorySectionProps} />
                ))}
                {noCategory.length > 0 && (
                  hasCategories
                    ? <CategorySection label="Others" feedList={noCategory} {...categorySectionProps} />
                    : <>
                        <div style={{ padding: '0.4rem 1rem', fontSize: '0.72rem', color: textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Feeds</div>
                        {noCategory.map(feed => {
                          const unread = feedUnreadCounts[feed.id] || 0;
                          const isActive = selectedFeedId === feed.id;
                          return (
                            <div key={feed.id} onClick={() => setSelectedFeedId(feed.id)} style={{
                              padding: '0.5rem 1rem', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: '0.6rem',
                              backgroundColor: isActive ? (isDarkMode ? '#444' : '#555') : 'transparent',
                              color: isActive ? 'white' : textPrimary,
                              borderRadius: '6px', margin: '0.1rem 0.5rem',
                              fontSize: '0.87rem', whiteSpace: 'nowrap', overflow: 'hidden',
                            }}
                            onMouseOver={e => { if (!isActive) e.currentTarget.style.backgroundColor = isDarkMode ? '#333' : '#eee'; }}
                            onMouseOut={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              {feed.faviconUrl ? <img src={feed.faviconUrl} alt="" style={{ width: '16px', height: '16px', borderRadius: '3px', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} /> : <FaRss style={{ flexShrink: 0, fontSize: '0.8rem', opacity: 0.5 }} />}
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{feed.title || feed.url}</span>
                              {unread > 0 && <span style={{ backgroundColor: isActive ? 'white' : (isDarkMode ? '#555' : '#bbb'), color: isActive ? (isDarkMode ? '#444' : '#555') : (isDarkMode ? '#eee' : '#fff'), borderRadius: '12px', padding: '0.1rem 0.4rem', fontSize: '0.72rem', fontWeight: '700', flexShrink: 0 }}>{unread}</span>}
                            </div>
                          );
                        })}
                      </>
                )}
              </div>
            </>
          )}
        </div>

        {/* MAIN CONTENT */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', marginLeft: sidebarPinned ? '0' : '12px' }}>

          {/* Toolbar */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 50,
            backgroundColor: isDarkMode ? 'rgba(26,26,26,0.92)' : 'rgba(240,240,240,0.92)',
            backdropFilter: 'blur(8px)', borderBottom: `1px solid ${border}`,
            padding: '0.6rem 1.5rem',
            display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
          }}>
            <input type="checkbox" checked={allChecked} ref={el => { if (el) el.indeterminate = someChecked; }} onChange={handleSelectAll}
              style={{ width: '16px', height: '16px', accentColor: '#FF6B35', cursor: 'pointer' }} title="全選択/全解除" />

            {['all', 'unread', 'read'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '0.3rem 0.85rem', border: `2px solid #FF6B35`, borderRadius: '20px',
                backgroundColor: filter === f ? '#FF6B35' : 'transparent',
                color: filter === f ? 'white' : '#FF6B35',
                cursor: 'pointer', fontSize: '0.83rem', fontWeight: '600',
              }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            {checkedArticles.size > 0 && (
              <>
                <button onClick={handleBatchAddToReadLater} style={{ padding: '0.3rem 0.85rem', backgroundColor: '#6f42c1', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '0.83rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <FaBookmark /> Read Later ({checkedArticles.size})
                </button>
                <button onClick={handleMarkCheckedAsRead} style={{ padding: '0.3rem 0.85rem', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '0.83rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <FaCheck /> 選択を既読 ({checkedArticles.size})
                </button>
              </>
            )}
            <button onClick={handleMarkAllAsRead} disabled={articlesLoading || unreadCount === 0} style={{ padding: '0.3rem 0.85rem', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '0.83rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem', opacity: unreadCount === 0 ? 0.5 : 1 }}>
              <FaCheck /> All Read
            </button>
            <button onClick={handleRefresh} disabled={articlesLoading} style={{ padding: '0.3rem 0.85rem', backgroundColor: '#FF6B35', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '0.83rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <FaSync /> Refresh
            </button>
            {/* 3択ビュートグル */}
            <button onClick={cycleViewMode} style={{ padding: '0.3rem 0.85rem', border: `1px solid ${border}`, borderRadius: '20px', backgroundColor: 'transparent', color: textSecondary, cursor: 'pointer', fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {viewModeLabel}
            </button>
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ padding: '0.3rem 0.7rem', backgroundColor: 'transparent', border: `1px solid ${border}`, borderRadius: '20px', color: textSecondary, cursor: 'pointer', fontSize: '0.83rem' }}>
              <FaArrowUp />
            </button>
            {articlesLoading && <div style={{ width: '18px', height: '18px', border: '3px solid #f3f3f3', borderTop: '3px solid #FF6B35', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />}
          </div>

          {/* Articles */}
          <div style={{ padding: '0.5rem 1.5rem 1rem', flex: 1 }}>
            {articlesError && <p style={{ color: 'red', textAlign: 'center' }}>{articlesError}</p>}

            {!articlesError && filteredArticles.length === 0 && (
              <div style={{ textAlign: 'center', padding: '4rem', color: textSecondary }}>
                <FaRss style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }} />
                <p>No articles found.</p>
              </div>
            )}

            {/* カテゴリグループ表示 */}
            {!articlesError && filteredArticles.length > 0 && useCategoryGroups && groupedArticles.map(([cat, artList]) => (
              <div key={cat} style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: `2px solid ${isDarkMode ? '#444' : '#e0e0e0'}` }}>
                  <span style={{ fontSize: '1rem', fontWeight: '700', color: textSecondary, textAlign: 'left' }}>
                    {cat === '__uncategorized__' ? 'Others' : cat}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: textSecondary }}>{artList.length}件</span>
                </div>
                {renderArticlesByMode(artList)}
              </div>
            ))}

            {/* フラット表示 */}
            {!articlesError && filteredArticles.length > 0 && !useCategoryGroups && renderArticlesByMode(filteredArticles)}

            {filteredArticles.length > 0 && hasMore && (
              <div ref={loadMoreRef} style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {loadingMore && <div style={{ width: '32px', height: '32px', border: '4px solid #f3f3f3', borderTop: '4px solid #FF6B35', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />}
              </div>
            )}
            {filteredArticles.length > 0 && !hasMore && (
              <p style={{ textAlign: 'center', color: textSecondary, fontSize: '0.85rem', padding: '2rem' }}>No more articles</p>
            )}
          </div>
        </div>
      </div>

      {selectedArticle && (
        <ArticleModal
          article={selectedArticle}
          onClose={() => setSelectedArticle(null)}
          onMarkAsRead={() => { if (selectedArticle) markAsRead(selectedArticle.id); }}
          onToggleFavorite={handleToggleFavorite}
          isRead={readArticles.has(selectedArticle?.id)}
          isFavorited={favoritedArticles.has(selectedArticle?.id)}
        />
      )}
    </div>
  );
};

export default DashboardPage;
