import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { LuCheck, LuRefreshCw, LuArrowUp, LuKeyboard, LuLayoutGrid, LuRows3, LuStar } from 'react-icons/lu';
import ReadingDrawer from '../components/ReadingDrawer';
import { getAccessToken } from '../lib/supabase';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';
import Navigation from '../components/Navigation';
import ArticleModal from '../components/ArticleModal';
import { useTheme } from '../contexts/ThemeContext';
import { useArticles } from '../contexts/ArticlesContext';
import { getTokens } from '../styles/tokens';

const DashboardPage = () => {
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [articlesError, setArticlesError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'
  const [selectedFeedId, setSelectedFeedId] = useState(''); // '' = All Feeds
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1); // keyboard-focused article row
  const [shortcutsOpen, setShortcutsOpen] = useState(false); // '?' help overlay
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('dashboardViewMode') || 'cards'); // 'cards' | 'compact'
  const [isWide, setIsWide] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true
  ); // wide screens get the two-pane reading view

  const location = useLocation();
  const { isDarkMode } = useTheme();
  const {
    articles,
    setArticles,
    readArticles,
    setReadArticles,
    favoritedArticles,
    setFavoritedArticles,
    feeds,
    setFeeds,
    lastArticleFetchTime,
    setLastArticleFetchTime,
    hasMore,
    setHasMore,
  } = useArticles();
  const observerRef = useRef(null);
  const articleRefs = useRef({});
  const loadMoreRef = useRef(null);
  const loadMoreObserverRef = useRef(null);
  const fullyViewedArticles = useRef(new Set()); // Track articles that were 100% visible
  const handleRefreshRef = useRef(null); // Ref to always get latest handleRefresh

  const apiClient = useMemo(() => createApiClient(
    import.meta.env.VITE_API_BASE_URL || '',
    getAccessToken
  ), []);

  const api = useMemo(() => new FeedOwnAPI(apiClient), [apiClient]);

  // Simple mark as read
  const markAsRead = useCallback(async (articleId) => {
    // Update UI immediately (optimistic)
    setReadArticles(prev => new Set([...prev, articleId]));

    try {
      await api.articles.markAsRead(articleId);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }, [api, setReadArticles]);

  const fetchFeeds = useCallback(async () => {
    try {
      const response = await api.feeds.list();
      if (response.success) {
        setFeeds(response.data.feeds || []);
      }
    } catch (error) {
      console.error('Failed to fetch feeds:', error);
    }
  }, [api]);

  const fetchArticles = useCallback(async (reset = true, feedId = null) => {
    if (reset) {
      setArticlesLoading(true);
      // Don't clear articles to keep them visible during refresh
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    setArticlesError(null);

    try {
      const currentOffset = reset ? 0 : articles.length;
      const limit = 50;

      const response = await api.articles.list({
        limit,
        offset: currentOffset,
        feedId: feedId || undefined,
      });

      if (response.success) {
        const newArticles = response.data.articles || [];
        const hasMoreData = response.data.hasMore ?? (newArticles.length === limit);

        if (reset) {
          setArticles(newArticles);
        } else {
          setArticles(prev => [...prev, ...newArticles]);
        }

        setHasMore(hasMoreData);

        // Build read articles set (merge with existing for incremental load)
        const readSet = reset ? new Set() : new Set(readArticles);
        newArticles.forEach(article => {
          if (article.isRead) {
            readSet.add(article.id);
          }
        });
        setReadArticles(readSet);

        // Update last fetch time only on reset (not for pagination)
        if (reset) {
          setLastArticleFetchTime(Date.now());
        }
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Failed to fetch articles:', error);
      setArticlesError('Failed to load articles.');
    } finally {
      if (reset) {
        setArticlesLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [api, articles.length]);

  const handleRefresh = useCallback(async () => {
    // Set loading state immediately for better UX
    setArticlesLoading(true);
    try {
      // Refresh feeds in batches to stay within Cloudflare's 50 subrequest limit
      let offset = 0;
      let totalNewArticles = 0;
      let totalSuccessful = 0;
      let totalFeeds = 0;
      let latestFeeds = null;

      while (true) {
        const refreshResponse = await api.refresh.refreshAll(offset || undefined);
        if (!refreshResponse.success) {
          console.error('Refresh batch failed at offset', offset);
          break;
        }

        const { stats, remaining, nextOffset } = refreshResponse.data;
        totalFeeds = stats.totalFeeds;
        totalSuccessful += stats.successfulFeeds;
        totalNewArticles += stats.newArticles;

        if (refreshResponse.data.feeds) {
          latestFeeds = refreshResponse.data.feeds;
        }

        // Log failed feeds if any (no alert popup)
        if (stats && stats.failedFeeds > 0 && stats.failedFeedDetails) {
          stats.failedFeedDetails.forEach((failed) => {
            console.error(`  - ${failed.feedTitle} (${failed.feedUrl}): ${failed.error}`);
          });
        }

        console.log(`🔄 Batch at offset ${offset}: ${stats.successfulFeeds} ok, ${stats.failedFeeds} failed, ${stats.newArticles} new articles, ${remaining ?? 0} remaining`);

        if (!remaining || remaining <= 0 || !nextOffset) break;
        offset = nextOffset;
      }

      console.log(`✅ Refresh complete: ${totalSuccessful}/${totalFeeds} feeds, ${totalNewArticles} new articles`);

      // OPTIMIZATION: Use feeds returned by refresh API instead of fetching again
      if (latestFeeds) {
        setFeeds(latestFeeds);
      } else {
        await fetchFeeds();
      }

      // Always fetch articles after refresh to ensure UI is up to date
      await fetchArticles(true, selectedFeedId); // reset=true for full reload
    } catch (error) {
      console.error('Failed to refresh:', error);
      setArticlesError('Failed to refresh feeds.');
      setArticlesLoading(false);
    }
  }, [api, fetchFeeds, fetchArticles, setFeeds, selectedFeedId]);

  // Keep ref updated with latest handleRefresh
  handleRefreshRef.current = handleRefresh;

  // Auto-refresh on initial load and when navigating back to dashboard
  useEffect(() => {
    // Use ref to always call latest handleRefresh (avoids stale closure issues)
    handleRefreshRef.current?.();
  }, [location.key]);

  // Refresh when navigating back to dashboard from other pages (fixes stale data after Clear All Data)
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    // If we're on dashboard and came from a different page, refresh
    if (location.pathname === '/dashboard' && prevPathRef.current !== '/dashboard') {
      fetchArticles(true, selectedFeedId);
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname, fetchArticles, selectedFeedId]);

  // Refresh when page becomes visible (handles browser tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Re-fetch articles without full refresh (just get latest data)
        fetchArticles(true, selectedFeedId);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchArticles, selectedFeedId]);

  // Auto-refresh RSS feeds every 15 minutes
  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (lastArticleFetchTime) {
        const now = Date.now();
        const fifteenMinutes = 15 * 60 * 1000; // 15 minutes in milliseconds

        if (now - lastArticleFetchTime >= fifteenMinutes) {
          console.log('🔄 Auto-refresh triggered (15 minutes elapsed) - fetching new articles from RSS feeds');
          handleRefreshRef.current?.(); // Use ref to call latest function
        }
      }
    }, 60 * 1000); // Check every 1 minute

    return () => clearInterval(checkInterval);
  }, [lastArticleFetchTime]);

  // Calculate unread count
  const unreadCount = useMemo(() => {
    return articles.filter(article => !readArticles.has(article.id)).length;
  }, [articles, readArticles]);

  // Filter articles based on selected filter
  useEffect(() => {
    if (filter === 'all') {
      setFilteredArticles(articles);
    } else if (filter === 'unread') {
      setFilteredArticles(articles.filter(article => !readArticles.has(article.id)));
    } else if (filter === 'read') {
      setFilteredArticles(articles.filter(article => readArticles.has(article.id)));
    }
  }, [articles, filter, readArticles]);

  // Scroll to top when filter changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [filter]);

  // Fetch articles when selected feed changes
  const prevFeedIdRef = useRef(selectedFeedId);
  useEffect(() => {
    // Skip initial render (handled by handleRefresh)
    if (prevFeedIdRef.current !== selectedFeedId) {
      fetchArticles(true, selectedFeedId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    prevFeedIdRef.current = selectedFeedId;
  }, [selectedFeedId, fetchArticles]);

  // Setup Intersection Observer for auto-mark-as-read
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Disable auto-mark-as-read when viewing Unread filter
    if (filter === 'unread') {
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const articleId = entry.target.dataset.articleId;
          if (!articleId || readArticles.has(articleId)) return;

          // Mark as fully viewed when 100% visible
          if (entry.isIntersecting && entry.intersectionRatio >= 1.0) {
            if (!fullyViewedArticles.current.has(articleId)) {
              fullyViewedArticles.current.add(articleId);
              // console.log('Article 100% visible:', articleId);
            }
          }

          // Mark as read when scrolled past (50% or less visible) after being fully viewed
          if (entry.isIntersecting && entry.intersectionRatio <= 0.5 && fullyViewedArticles.current.has(articleId)) {
            fullyViewedArticles.current.delete(articleId);
            markAsRead(articleId);
          }

          // Also mark as read when completely leaving viewport after being fully viewed
          if (!entry.isIntersecting && fullyViewedArticles.current.has(articleId)) {
            fullyViewedArticles.current.delete(articleId);
            markAsRead(articleId);
          }
        });
      },
      { threshold: [0, 0.5, 1.0] } // Trigger at 0% (leaving), 50% (half visible), and 100% (fully visible)
    );

    // Observe all article cards
    Object.values(articleRefs.current).forEach((ref) => {
      if (ref && observerRef.current) {
        observerRef.current.observe(ref);
      }
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [filteredArticles, readArticles, markAsRead, filter]);

  // Reset keyboard focus when the visible list changes (filter / feed switch)
  useEffect(() => {
    setFocusedIndex(-1);
  }, [filter, selectedFeedId]);

  // Setup Intersection Observer for infinite scroll
  useEffect(() => {
    if (loadMoreObserverRef.current) {
      loadMoreObserverRef.current.disconnect();
    }

    loadMoreObserverRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loadingMore && !articlesLoading) {
          fetchArticles(false, selectedFeedId);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      loadMoreObserverRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (loadMoreObserverRef.current) {
        loadMoreObserverRef.current.disconnect();
      }
    };
  }, [hasMore, loadingMore, articlesLoading, selectedFeedId]);

  const handleMarkAllAsRead = async () => {
    if (articlesLoading) return;

    const unreadArticleIds = articles.filter(article => !readArticles.has(article.id)).map(a => a.id);
    if (unreadArticleIds.length === 0) {
      return;
    }

    // Optimistically update UI
    setReadArticles(prev => {
      const newSet = new Set(prev);
      unreadArticleIds.forEach(id => newSet.add(id));
      return newSet;
    });

    // Mark all as read using batch API (single request instead of N requests)
    try {
      await api.articles.batchMarkAsRead(unreadArticleIds);
      // Refresh articles after marking all as read
      await fetchArticles(true, selectedFeedId);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      // Rollback on error
      setReadArticles(prev => {
        const newSet = new Set(prev);
        unreadArticleIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  };

  const handleArticleClick = (article) => {
    setSelectedArticle(article);

    // Mark as read when opening modal (uses debounced batch API)
    if (!readArticles.has(article.id)) {
      markAsRead(article.id);
    }
  };

  const handleCloseModal = () => {
    setSelectedArticle(null);
  };

  const handleMarkAsRead = () => {
    if (!selectedArticle) return;
    markAsRead(selectedArticle.id);
  };

  const toggleFavoriteForArticle = useCallback(async (article) => {
    if (!article) return;

    try {
      if (favoritedArticles.has(article.id)) {
        await api.articles.removeFromFavorites(article.id);
        setFavoritedArticles(prev => {
          const newSet = new Set(prev);
          newSet.delete(article.id);
          return newSet;
        });
      } else {
        await api.articles.addToFavorites(
          article.id,
          {
            title: article.title,
            url: article.url,
            description: article.description,
            feedTitle: article.feedTitle,
            imageUrl: article.imageUrl,
          }
        );
        setFavoritedArticles(prev => new Set([...prev, article.id]));
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  }, [api, favoritedArticles, setFavoritedArticles]);

  const handleToggleFavorite = () => toggleFavoriteForArticle(selectedArticle);

  // Keyboard shortcuts (RSS-reader style). Disabled while typing in a field.
  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target;
      const tag = target?.tagName;
      const isTyping =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;
      if (isTyping) return;

      // Modifier combos are for the browser, not us
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Escape closes overlays first
      if (e.key === 'Escape') {
        if (shortcutsOpen) setShortcutsOpen(false);
        else if (selectedArticle) setSelectedArticle(null);
        return;
      }

      // '?' toggles the shortcut help overlay
      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen(prev => !prev);
        return;
      }

      // While the help overlay or article modal is open, don't drive the list
      if (shortcutsOpen || selectedArticle) return;

      const list = filteredArticles;
      const focusArticleAt = (index) => {
        setFocusedIndex(index);
        const article = list[index];
        const el = article && articleRefs.current[article.id];
        if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      };

      switch (e.key) {
        case 'j': // next article
          e.preventDefault();
          if (list.length > 0) focusArticleAt(Math.min(list.length - 1, focusedIndex + 1));
          break;
        case 'k': // previous article
          e.preventDefault();
          if (list.length > 0) focusArticleAt(Math.max(0, focusedIndex <= 0 ? 0 : focusedIndex - 1));
          break;
        case 'o': // open focused article
        case 'Enter': {
          const article = list[focusedIndex];
          if (article) {
            e.preventDefault();
            handleArticleClick(article);
          }
          break;
        }
        case 'm': { // mark focused as read
          const article = list[focusedIndex];
          if (article && !readArticles.has(article.id)) {
            e.preventDefault();
            markAsRead(article.id);
          }
          break;
        }
        case 's': { // toggle favorite on focused
          const article = list[focusedIndex];
          if (article) {
            e.preventDefault();
            toggleFavoriteForArticle(article);
          }
          break;
        }
        case 'r': // refresh
          e.preventDefault();
          handleRefreshRef.current?.();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredArticles, focusedIndex, selectedArticle, shortcutsOpen, readArticles, markAsRead, toggleFavoriteForArticle]);

  // Clicking anywhere outside an article card clears the keyboard focus highlight
  useEffect(() => {
    const handleClick = (e) => {
      if (!e.target.closest('[data-article-id]')) {
        setFocusedIndex(-1);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Persist the chosen list density
  useEffect(() => {
    localStorage.setItem('dashboardViewMode', viewMode);
  }, [viewMode]);

  // Track viewport width to switch between two-pane (wide) and modal (narrow)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e) => setIsWide(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const getRelativeTime = (dateString) => {
    if (!dateString) return 'Unknown date';

    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) {
      return 'just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getFeedFavicon = (feedId) => {
    const feed = feeds.find(f => f.id === feedId);
    return feed?.faviconUrl || null;
  };

  const { color, radius, shadow } = getTokens(isDarkMode);

  const secondaryButton = {
    padding: '0.5rem 1rem',
    backgroundColor: color.surface,
    color: color.text,
    border: `1px solid ${color.border}`,
    borderRadius: radius.sm,
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 600,
    transition: 'background-color 0.2s, border-color 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
  };

  const styles = {
    container: {
      paddingLeft: '2rem',
      paddingRight: '2rem',
      paddingBottom: '2rem',
      paddingTop: '1.25rem',
      maxWidth: '1200px',
      margin: '0 auto',
    },
    controlsWrapper: {
      position: 'sticky',
      top: '55px',
      backgroundColor: color.controlsBg,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      zIndex: 50,
      borderBottom: `1px solid ${color.border}`,
      width: '100%',
    },
    controls: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: '0.85rem',
      paddingBottom: '0.85rem',
      paddingLeft: '2rem',
      paddingRight: '2rem',
      flexWrap: 'wrap',
      gap: '1rem',
      maxWidth: '1200px',
      margin: '0 auto',
    },
    buttonGroup: {
      display: 'flex',
      gap: '0.5rem',
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    filterGroup: {
      display: 'inline-flex',
      gap: '0.2rem',
      padding: '0.2rem',
      backgroundColor: color.surface2,
      borderRadius: radius.md,
      border: `1px solid ${color.border}`,
    },
    leftControls: {
      display: 'flex',
      gap: '0.75rem',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    feedSelector: {
      padding: '0.5rem 0.85rem',
      border: `1px solid ${color.border}`,
      backgroundColor: color.surface,
      color: color.text,
      borderRadius: radius.sm,
      cursor: 'pointer',
      fontSize: '0.9rem',
      fontWeight: 600,
      minWidth: '150px',
      maxWidth: '250px',
    },
    filterButton: {
      padding: '0.4rem 0.9rem',
      border: 'none',
      backgroundColor: 'transparent',
      color: color.textMuted,
      borderRadius: radius.sm,
      cursor: 'pointer',
      fontSize: '0.9rem',
      fontWeight: 600,
      transition: 'background-color 0.2s, color 0.2s',
    },
    activeFilter: {
      backgroundColor: color.accent,
      color: color.onAccent,
      boxShadow: shadow.sm,
    },
    refreshButton: {
      padding: '0.5rem 1.25rem',
      backgroundColor: color.accent,
      color: color.onAccent,
      border: 'none',
      borderRadius: radius.sm,
      cursor: 'pointer',
      fontSize: '0.9rem',
      fontWeight: 600,
      transition: 'background-color 0.2s',
      display: 'flex',
      alignItems: 'center',
      gap: '0.45rem',
      boxShadow: shadow.sm,
    },
    markAllReadButton: {
      ...secondaryButton,
    },
    scrollTopButton: {
      ...secondaryButton,
    },
    shortcutsButton: {
      ...secondaryButton,
      padding: '0.5rem 0.7rem',
    },
    buttonIcon: {
      fontSize: '0.85rem',
    },
    articlesList: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr)',
      gap: '0.85rem',
    },
    articleCard: {
      backgroundColor: color.surface,
      borderRadius: radius.md,
      padding: '1rem',
      boxShadow: shadow.sm,
      cursor: 'pointer',
      transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
      borderStyle: 'solid',
      borderWidth: '1px',
      borderLeftWidth: '3px',
      display: 'flex',
      gap: '1rem',
    },
    articleCardRead: {
      opacity: 0.55,
    },
    compactRow: {
      backgroundColor: color.surface,
      borderRadius: radius.sm,
      borderStyle: 'solid',
      borderWidth: '1px',
      borderLeftWidth: '3px',
      padding: '0.6rem 0.85rem',
      cursor: 'pointer',
      transition: 'background-color 0.2s, border-color 0.2s',
      display: 'flex',
      alignItems: 'center',
      gap: '0.7rem',
    },
    compactTitle: {
      flex: 1,
      minWidth: 0,
      color: color.text,
      fontSize: '0.98rem',
      fontWeight: 600,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    compactSource: {
      color: color.accent,
      fontSize: '0.82rem',
      fontWeight: 600,
      flexShrink: 0,
      maxWidth: '160px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    compactTime: {
      color: color.textFaint,
      fontSize: '0.8rem',
      flexShrink: 0,
    },
    starButton: {
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      padding: '0.25rem',
      color: color.textFaint,
      display: 'inline-flex',
      alignItems: 'center',
      flexShrink: 0,
      lineHeight: 1,
    },
    starButtonActive: {
      color: color.accent,
    },
    viewToggleButton: {
      ...secondaryButton,
      padding: '0.5rem 0.7rem',
    },
    shortcutsOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: color.overlay,
      backdropFilter: 'blur(2px)',
      WebkitBackdropFilter: 'blur(2px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1100,
      padding: '1rem',
    },
    shortcutsPanel: {
      backgroundColor: color.surface,
      color: color.text,
      borderRadius: radius.lg,
      padding: '1.5rem 2rem',
      minWidth: '320px',
      maxWidth: '90vw',
      border: `1px solid ${color.border}`,
      boxShadow: shadow.lg,
    },
    shortcutsTitle: {
      margin: '0 0 1rem',
      fontSize: '1.25rem',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    shortcutRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      padding: '0.35rem 0',
    },
    kbd: {
      display: 'inline-block',
      minWidth: '5.5rem',
      textAlign: 'center',
      padding: '0.2rem 0.5rem',
      borderRadius: radius.sm,
      border: `1px solid ${color.borderStrong}`,
      backgroundColor: color.surface2,
      color: color.text,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '0.85rem',
    },
    thumbnail: {
      width: '200px',
      height: '120px',
      objectFit: 'cover',
      borderRadius: radius.sm,
      flexShrink: 0,
      backgroundColor: color.surface2,
    },
    noThumbnail: {
      width: '200px',
      height: '120px',
      borderRadius: radius.sm,
      flexShrink: 0,
      backgroundColor: color.surface2,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: color.textFaint,
      fontSize: '0.8rem',
    },
    articleContent: {
      flex: 1,
      minWidth: 0,
    },
    articleMeta: {
      display: 'flex',
      gap: '0.5rem',
      alignItems: 'center',
      fontSize: '0.82rem',
      color: color.textFaint,
      marginBottom: '0.4rem',
      flexWrap: 'wrap',
    },
    feedTitle: {
      color: color.accent,
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
    },
    favicon: {
      width: '16px',
      height: '16px',
      borderRadius: '3px',
      flexShrink: 0,
    },
    unreadDot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: color.accent,
      flexShrink: 0,
    },
    readTag: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.25rem',
      color: color.success,
      fontWeight: 600,
    },
    articleTitle: {
      color: color.text,
      marginBottom: '0.4rem',
      fontSize: '1.15rem',
      fontWeight: 700,
      lineHeight: '1.35',
      letterSpacing: '-0.01em',
    },
    articleDescription: {
      color: color.textMuted,
      lineHeight: '1.5',
      fontSize: '0.95rem',
      marginBottom: '0.5rem',
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
    },
    noArticles: {
      textAlign: 'center',
      padding: '3rem',
      color: color.textMuted,
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
    inlineSpinner: {
      border: `3px solid ${color.surface2}`,
      borderTop: `3px solid ${color.accent}`,
      borderRadius: '50%',
      width: '20px',
      height: '20px',
      animation: 'spin 1s linear infinite',
      display: 'inline-block',
      marginLeft: '0.5rem',
    },
    loadMoreTrigger: {
      height: '100px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingMore: {
      textAlign: 'center',
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1rem',
    },
    endOfArticles: {
      textAlign: 'center',
      padding: '2rem',
      color: color.textFaint,
      fontSize: '0.9rem',
    },
  };

  const showSkeletons = articlesLoading && filteredArticles.length === 0;
  const skVars = { '--sk-base': color.surface2, '--sk-hl': color.surfaceHover };

  const renderStar = (article, isFav) => (
    <button
      style={{ ...styles.starButton, ...(isFav ? styles.starButtonActive : {}) }}
      onClick={(e) => { e.stopPropagation(); toggleFavoriteForArticle(article); }}
      title={isFav ? 'Unfavorite' : 'Add to favorites'}
      aria-label={isFav ? 'Unfavorite' : 'Add to favorites'}
    >
      <LuStar size={16} fill={isFav ? 'currentColor' : 'none'} />
    </button>
  );

  const renderArticle = (article, index) => {
    const isRead = readArticles.has(article.id);
    const isFocused = index === focusedIndex;
    const isFav = favoritedArticles.has(article.id);
    // Border colors are always set explicitly (never removed between renders) to
    // avoid the React shorthand/longhand stale-inline-style bug that left a faint
    // ring on cards after focus moved away.
    const stateStyle = {
      ...(isRead ? styles.articleCardRead : {}),
      borderColor: isFocused ? color.accent : color.border,
      borderLeftColor: (isFocused || !isRead) ? color.accent : color.border,
    };

    if (viewMode === 'compact') {
      return (
        <div
          key={article.id}
          ref={(el) => (articleRefs.current[article.id] = el)}
          data-article-id={article.id}
          style={{ ...styles.compactRow, ...stateStyle }}
          onClick={() => handleArticleClick(article)}
          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = color.surfaceHover; }}
          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = color.surface; }}
        >
          {getFeedFavicon(article.feedId) && (
            <img
              src={getFeedFavicon(article.feedId)}
              alt=""
              style={styles.favicon}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}
          <span style={styles.compactTitle}>{article.title}</span>
          <span style={styles.compactSource}>{article.feedTitle || 'Unknown Feed'}</span>
          <span style={styles.compactTime}>{getRelativeTime(article.publishedAt)}</span>
          {isRead && <LuCheck style={{ color: color.success, fontSize: '0.8rem', flexShrink: 0 }} />}
          {renderStar(article, isFav)}
        </div>
      );
    }

    return (
      <div
        key={article.id}
        ref={(el) => (articleRefs.current[article.id] = el)}
        data-article-id={article.id}
        style={{ ...styles.articleCard, ...stateStyle }}
        onClick={() => handleArticleClick(article)}
        onMouseOver={(e) => {
          e.currentTarget.style.boxShadow = shadow.md;
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.boxShadow = shadow.sm;
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        {article.imageUrl ? (
          <img src={article.imageUrl} alt={article.title} style={styles.thumbnail} />
        ) : (
          <div style={styles.noThumbnail}>No image</div>
        )}
        <div style={styles.articleContent}>
          <div style={styles.articleMeta}>
            <span style={styles.feedTitle}>
              {getFeedFavicon(article.feedId) && (
                <img
                  src={getFeedFavicon(article.feedId)}
                  alt=""
                  style={styles.favicon}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              {article.feedTitle || 'Unknown Feed'}
            </span>
            <span>•</span>
            <span>{getRelativeTime(article.publishedAt)}</span>
            {isRead && (
              <span style={styles.readTag}>
                <LuCheck style={{ fontSize: '0.72rem' }} /> Read
              </span>
            )}
            <span style={{ marginLeft: 'auto' }}>{renderStar(article, isFav)}</span>
          </div>
          <h3 style={styles.articleTitle}>{article.title}</h3>
          <p style={styles.articleDescription}>
            {article.description || 'No description available'}
          </p>
        </div>
      </div>
    );
  };

  const renderSkeleton = (i) => (
    <div key={`sk-${i}`} style={{ ...styles.articleCard, cursor: 'default' }}>
      <div className="fo-skeleton" style={{ width: '200px', height: '120px', flexShrink: 0, ...skVars }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="fo-skeleton" style={{ width: '40%', height: '0.75rem', marginBottom: '0.75rem', ...skVars }} />
        <div className="fo-skeleton" style={{ width: '92%', height: '1.15rem', marginBottom: '0.6rem', ...skVars }} />
        <div className="fo-skeleton" style={{ width: '100%', height: '0.8rem', marginBottom: '0.45rem', ...skVars }} />
        <div className="fo-skeleton" style={{ width: '70%', height: '0.8rem', ...skVars }} />
      </div>
    </div>
  );

  return (
    <div>
      <Navigation unreadCount={unreadCount} />
      <div style={styles.controlsWrapper}>
        <div style={styles.controls}>
          <div style={styles.leftControls}>
            <select
              value={selectedFeedId}
              onChange={(e) => setSelectedFeedId(e.target.value)}
              style={styles.feedSelector}
            >
              <option value="">All Feeds</option>
              {feeds.map((feed) => (
                <option key={feed.id} value={feed.id}>
                  {feed.title || feed.url}
                </option>
              ))}
            </select>

            <div style={styles.filterGroup}>
              {['all', 'unread', 'read'].map((key) => {
                const isActive = filter === key;
                const label = key.charAt(0).toUpperCase() + key.slice(1);
                return (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    style={{
                      ...styles.filterButton,
                      ...(isActive ? styles.activeFilter : {}),
                    }}
                    onMouseOver={(e) => {
                      if (!isActive) e.currentTarget.style.color = color.text;
                    }}
                    onMouseOut={(e) => {
                      if (!isActive) e.currentTarget.style.color = color.textMuted;
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={styles.buttonGroup}>
            <button
              onClick={() => setViewMode((m) => (m === 'cards' ? 'compact' : 'cards'))}
              style={styles.viewToggleButton}
              title={viewMode === 'cards' ? 'Switch to compact list' : 'Switch to card view'}
              aria-label="Toggle list density"
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = color.surfaceHover; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = color.surface; }}
            >
              {viewMode === 'cards' ? <LuRows3 style={styles.buttonIcon} /> : <LuLayoutGrid style={styles.buttonIcon} />}
            </button>
            <button
              onClick={handleMarkAllAsRead}
              style={styles.markAllReadButton}
              disabled={articlesLoading || unreadCount === 0}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = color.surfaceHover; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = color.surface; }}
            >
              <LuCheck style={styles.buttonIcon} /> Mark All Read
            </button>
            <button
              onClick={handleRefresh}
              style={styles.refreshButton}
              disabled={articlesLoading}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = color.accentHover; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = color.accent; }}
            >
              <LuRefreshCw style={styles.buttonIcon} /> Refresh
            </button>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              style={styles.scrollTopButton}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = color.surfaceHover; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = color.surface; }}
            >
              <LuArrowUp style={styles.buttonIcon} /> Top
            </button>
            <button
              onClick={() => setShortcutsOpen(true)}
              style={styles.shortcutsButton}
              title="Keyboard shortcuts (press ?)"
              aria-label="Keyboard shortcuts"
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = color.surfaceHover; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = color.surface; }}
            >
              <LuKeyboard style={styles.buttonIcon} />
            </button>
            {articlesLoading && (
              <div style={styles.inlineSpinner}></div>
            )}
          </div>
        </div>
      </div>

      <div style={styles.container}>
        {articlesError && (
          <p style={{ color: color.danger, textAlign: 'center' }}>{articlesError}</p>
        )}

        {!articlesError && (
          showSkeletons ? (
            <div style={styles.articlesList}>
              {Array.from({ length: 6 }).map((_, i) => renderSkeleton(i))}
            </div>
          ) : (
            <div style={styles.articlesList}>
              {filteredArticles.length > 0 ? (
                filteredArticles.map((article, index) => renderArticle(article, index))
              ) : (
                <div style={styles.noArticles}>
                  <p>No articles found.</p>
                  <p>Try adding some feeds or changing the filter.</p>
                </div>
              )}

              {/* Load more trigger for infinite scroll */}
              {filteredArticles.length > 0 && hasMore && (
                <div ref={loadMoreRef} style={styles.loadMoreTrigger}>
                  {loadingMore && (
                    <div style={styles.loadingMore}>
                      <div style={styles.loadingSpinner}></div>
                      <p>Loading more articles...</p>
                    </div>
                  )}
                </div>
              )}

              {/* End of articles indicator */}
              {filteredArticles.length > 0 && !hasMore && (
                <div style={styles.endOfArticles}>
                  <p>No more articles to load</p>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* Wide screens: Feedly-style slide-over drawer covering most of the screen */}
      {selectedArticle && isWide && (
        <ReadingDrawer
          article={selectedArticle}
          onClose={handleCloseModal}
          onMarkAsRead={handleMarkAsRead}
          onToggleFavorite={handleToggleFavorite}
          isRead={readArticles.has(selectedArticle.id)}
          isFavorited={favoritedArticles.has(selectedArticle.id)}
        />
      )}

      {/* Narrow screens: centered modal */}
      {selectedArticle && !isWide && (
        <ArticleModal
          article={selectedArticle}
          onClose={handleCloseModal}
          onMarkAsRead={handleMarkAsRead}
          onToggleFavorite={handleToggleFavorite}
          isRead={readArticles.has(selectedArticle.id)}
          isFavorited={favoritedArticles.has(selectedArticle.id)}
        />
      )}

      {shortcutsOpen && (
        <div
          style={styles.shortcutsOverlay}
          onClick={() => setShortcutsOpen(false)}
        >
          <div style={styles.shortcutsPanel} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.shortcutsTitle}>Keyboard Shortcuts</h3>
            {[
              ['j', 'Next article'],
              ['k', 'Previous article'],
              ['o / Enter', 'Open focused article'],
              ['m', 'Mark focused as read'],
              ['s', 'Toggle favorite'],
              ['r', 'Refresh'],
              ['?', 'Toggle this help'],
              ['Esc', 'Close dialog'],
            ].map(([key, desc]) => (
              <div key={key} style={styles.shortcutRow}>
                <kbd style={styles.kbd}>{key}</kbd>
                <span>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
