import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { LuCheck, LuStar, LuExternalLink, LuBookOpen, LuAlignLeft } from 'react-icons/lu';
import { useTheme } from '../contexts/ThemeContext';
import { getTokens } from '../styles/tokens';

// Shared article body used by both the modal (narrow screens) and the
// two-pane reading view (wide screens). Handles reader-mode extraction via
// /api/article-content (Readability) with DOMPurify sanitization.
const ArticleReader = ({ article, onMarkAsRead, onToggleFavorite, isRead, isFavorited }) => {
  const { isDarkMode } = useTheme();
  const { color, radius } = getTokens(isDarkMode);

  const [readerMode, setReaderMode] = useState(false);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerError, setReaderError] = useState(null);
  const [readerHtml, setReaderHtml] = useState(null);
  const [readerByline, setReaderByline] = useState(null);

  // Reset reader state whenever the displayed article changes
  useEffect(() => {
    setReaderMode(false);
    setReaderLoading(false);
    setReaderError(null);
    setReaderHtml(null);
    setReaderByline(null);
  }, [article?.url]);

  const loadReaderContent = async () => {
    if (!article?.url) return;
    setReaderLoading(true);
    setReaderError(null);
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const res = await fetch(
        `${apiBaseUrl}/api/article-content?url=${encodeURIComponent(article.url)}`
      );
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && data.article?.content) {
        const clean = DOMPurify.sanitize(data.article.content, {
          USE_PROFILES: { html: true },
        });
        setReaderHtml(clean);
        setReaderByline(data.article.byline || null);
      } else {
        setReaderError(
          (data && data.error) || 'Could not extract the article content.'
        );
      }
    } catch {
      setReaderError('Failed to load the article. Check your connection.');
    } finally {
      setReaderLoading(false);
    }
  };

  const handleToggleReader = () => {
    const next = !readerMode;
    setReaderMode(next);
    if (next && readerHtml === null && !readerLoading && !readerError) {
      loadReaderContent();
    }
  };

  const button = {
    padding: '0.6rem 1.1rem',
    border: 'none',
    borderRadius: radius.sm,
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 600,
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.45rem',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };

  const styles = {
    image: {
      width: '100%',
      height: 'auto',
      maxHeight: '320px',
      objectFit: 'contain',
      borderRadius: radius.md,
      marginBottom: '1.5rem',
      backgroundColor: color.surface2,
    },
    actions: {
      display: 'flex',
      gap: '0.6rem',
      marginBottom: '1.5rem',
      paddingBottom: '1.5rem',
      borderBottom: `1px solid ${color.border}`,
      flexWrap: 'nowrap',
      overflowX: 'auto',
    },
    readButton: { ...button, backgroundColor: color.surface2, color: color.text },
    favoriteButton: {
      ...button,
      backgroundColor: isFavorited ? color.accentSoft : color.surface2,
      color: isFavorited ? color.accent : color.text,
    },
    readerButton: {
      ...button,
      backgroundColor: readerMode ? color.accent : color.surface2,
      color: readerMode ? color.onAccent : color.text,
    },
    visitButton: { ...button, backgroundColor: color.accent, color: color.onAccent, textDecoration: 'none' },
    buttonIcon: { fontSize: '0.95rem' },
    title: {
      fontSize: '1.9rem',
      fontWeight: 800,
      color: color.text,
      marginBottom: '1rem',
      lineHeight: '1.25',
      letterSpacing: '-0.02em',
    },
    titleLink: { color: 'inherit', textDecoration: 'none' },
    meta: {
      display: 'flex',
      gap: '0.6rem',
      fontSize: '0.88rem',
      color: color.textFaint,
      marginBottom: '1.5rem',
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    metaSource: { color: color.accent, fontWeight: 600 },
    description: {
      fontSize: '1.05rem',
      lineHeight: '1.8',
      color: color.textMuted,
      marginBottom: '2rem',
      whiteSpace: 'pre-wrap',
    },
    readerContent: {
      fontSize: '1.05rem',
      lineHeight: '1.8',
      color: color.text,
      marginBottom: '2rem',
    },
    readerByline: {
      fontSize: '0.92rem',
      fontStyle: 'italic',
      color: color.textFaint,
      marginBottom: '1rem',
    },
    readerStatus: {
      fontSize: '1rem',
      color: color.textMuted,
      padding: '2rem 0',
      textAlign: 'center',
    },
  };

  return (
    <>
      {article.imageUrl && (
        <img src={article.imageUrl} alt={article.title} style={styles.image} />
      )}
      <div style={styles.actions}>
        <button style={styles.readButton} onClick={onMarkAsRead} disabled={isRead}>
          <LuCheck style={styles.buttonIcon} />
          {isRead ? 'Marked as Read' : 'Mark as Read'}
        </button>
        <button style={styles.favoriteButton} onClick={onToggleFavorite}>
          <LuStar style={styles.buttonIcon} fill={isFavorited ? 'currentColor' : 'none'} />
          {isFavorited ? 'Unfavorite' : 'Add to Favorites'}
        </button>
        <button style={styles.readerButton} onClick={handleToggleReader}>
          {readerMode ? <LuAlignLeft style={styles.buttonIcon} /> : <LuBookOpen style={styles.buttonIcon} />}
          {readerMode ? 'Show Summary' : 'Reader Mode'}
        </button>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          style={styles.visitButton}
        >
          <LuExternalLink style={styles.buttonIcon} />
          Visit Original
        </a>
      </div>
      <h2 style={styles.title}>
        <a href={article.url} target="_blank" rel="noopener noreferrer" style={styles.titleLink}>
          {article.title}
        </a>
      </h2>
      <div style={styles.meta}>
        <span style={styles.metaSource}>{article.feedTitle || 'Unknown Feed'}</span>
        <span>•</span>
        <span>{getRelativeTime(article.publishedAt)}</span>
        {article.author && (
          <>
            <span>•</span>
            <span>by {article.author}</span>
          </>
        )}
      </div>
      {readerMode ? (
        <div>
          {readerLoading && <div style={styles.readerStatus}>Loading article…</div>}
          {!readerLoading && readerError && (
            <div style={styles.readerStatus}>
              <p>{readerError}</p>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...styles.visitButton, display: 'inline-flex', marginTop: '1rem' }}
              >
                <LuExternalLink style={styles.buttonIcon} />
                Visit Original
              </a>
            </div>
          )}
          {!readerLoading && !readerError && readerHtml !== null && (
            <>
              {readerByline && <div style={styles.readerByline}>{readerByline}</div>}
              <div
                className="fo-reader-content"
                style={styles.readerContent}
                dangerouslySetInnerHTML={{ __html: readerHtml }}
              />
            </>
          )}
        </div>
      ) : (
        <div style={styles.description}>
          {article.description || 'No content available'}
        </div>
      )}
      <style>{`
        .fo-reader-content img { max-width: 100%; height: auto; border-radius: 8px; margin: 0.5rem 0; }
        .fo-reader-content a { color: ${color.accent}; }
        .fo-reader-content figure { margin: 1rem 0; }
        .fo-reader-content figcaption { font-size: 0.9rem; color: ${color.textFaint}; }
        .fo-reader-content pre { overflow-x: auto; padding: 1rem; border-radius: 8px; background: ${color.surface2}; }
        .fo-reader-content code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .fo-reader-content blockquote { border-left: 3px solid ${color.borderStrong}; margin: 1rem 0; padding-left: 1rem; color: ${color.textMuted}; }
        .fo-reader-content h1, .fo-reader-content h2, .fo-reader-content h3 { line-height: 1.3; margin: 1.5rem 0 0.75rem; color: ${color.text}; }
        .fo-reader-content table { max-width: 100%; display: block; overflow-x: auto; }
      `}</style>
    </>
  );
};

// Helper function to get relative time
const getRelativeTime = (dateString) => {
  if (!dateString) return 'Unknown date';

  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString();
  }
};

export default ArticleReader;
