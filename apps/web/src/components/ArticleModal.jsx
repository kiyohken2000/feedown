import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { FaCheck, FaStar, FaRegStar, FaExternalLinkAlt, FaBookOpen, FaAlignLeft } from 'react-icons/fa';
import { useTheme } from '../contexts/ThemeContext';

const ArticleModal = ({ article, onClose, onMarkAsRead, onToggleFavorite, isRead, isFavorited }) => {
  const { isDarkMode } = useTheme();

  // Reader mode: fetch and display the full article body extracted server-side
  // via /api/article-content (Readability). Sanitized with DOMPurify before render.
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
    // Fetch on first activation only
    if (next && readerHtml === null && !readerLoading && !readerError) {
      loadReaderContent();
    }
  };
  const styles = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      padding: '1rem',
    },
    modal: {
      backgroundColor: isDarkMode ? '#2d2d2d' : 'white',
      borderRadius: '12px',
      maxWidth: '800px',
      width: '100%',
      maxHeight: '90vh',
      overflow: 'auto',
      boxShadow: isDarkMode ? '0 8px 32px rgba(0, 0, 0, 0.6)' : '0 8px 32px rgba(0, 0, 0, 0.3)',
      position: 'relative',
    },
    closeButton: {
      position: 'absolute',
      top: '1rem',
      right: '1rem',
      background: 'transparent',
      border: 'none',
      fontSize: '2.5rem',
      cursor: 'pointer',
      padding: '0.5rem',
      color: isDarkMode ? '#b0b0b0' : '#666',
      zIndex: 10,
      width: '3rem',
      height: '3rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '50%',
      transition: 'background-color 0.3s',
    },
    content: {
      padding: '2rem',
    },
    image: {
      width: '100%',
      height: 'auto',
      maxHeight: '300px',
      objectFit: 'contain',
      borderRadius: '8px',
      marginBottom: '1.5rem',
      backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
    },
    title: {
      fontSize: '2rem',
      fontWeight: 'bold',
      color: isDarkMode ? '#e0e0e0' : '#333',
      marginBottom: '1rem',
      lineHeight: '1.3',
      textDecoration: 'none',
      display: 'inline-block',
      cursor: 'pointer',
    },
    meta: {
      display: 'flex',
      gap: '1rem',
      fontSize: '0.9rem',
      color: isDarkMode ? '#b0b0b0' : '#999',
      marginBottom: '1.5rem',
      flexWrap: 'wrap',
    },
    description: {
      fontSize: '1.1rem',
      lineHeight: '1.8',
      color: isDarkMode ? '#b0b0b0' : '#444',
      marginBottom: '2rem',
      whiteSpace: 'pre-wrap',
    },
    actions: {
      display: 'flex',
      gap: '1rem',
      marginBottom: '1.5rem',
      paddingBottom: '1.5rem',
      borderBottom: isDarkMode ? '1px solid #444' : '1px solid #eee',
      flexWrap: 'wrap',
    },
    button: {
      padding: '0.75rem 1.5rem',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: '600',
      transition: 'all 0.3s',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    readButton: {
      backgroundColor: '#28a745',
      color: 'white',
    },
    favoriteButton: {
      backgroundColor: '#ffc107',
      color: '#333',
    },
    visitButton: {
      backgroundColor: '#FF6B35',
      color: 'white',
      textDecoration: 'none',
    },
    readerButton: {
      backgroundColor: readerMode ? '#5a6268' : '#6c757d',
      color: 'white',
    },
    buttonIcon: {
      fontSize: '0.9rem',
    },
    readerContent: {
      fontSize: '1.1rem',
      lineHeight: '1.8',
      color: isDarkMode ? '#c8c8c8' : '#333',
      marginBottom: '2rem',
    },
    readerByline: {
      fontSize: '0.95rem',
      fontStyle: 'italic',
      color: isDarkMode ? '#b0b0b0' : '#777',
      marginBottom: '1rem',
    },
    readerStatus: {
      fontSize: '1rem',
      color: isDarkMode ? '#b0b0b0' : '#777',
      padding: '2rem 0',
      textAlign: 'center',
    },
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div style={styles.overlay} onClick={handleOverlayClick}>
      <div style={styles.modal}>
        <button
          style={styles.closeButton}
          onClick={onClose}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          ×
        </button>
        <div style={styles.content}>
          {article.imageUrl && (
            <img src={article.imageUrl} alt={article.title} style={styles.image} />
          )}
          <div style={styles.actions}>
            <button
              style={{ ...styles.button, ...styles.readButton }}
              onClick={onMarkAsRead}
              disabled={isRead}
            >
              <FaCheck style={styles.buttonIcon} />
              {isRead ? 'Marked as Read' : 'Mark as Read'}
            </button>
            <button
              style={{ ...styles.button, ...styles.favoriteButton }}
              onClick={onToggleFavorite}
            >
              {isFavorited ? <FaStar style={styles.buttonIcon} /> : <FaRegStar style={styles.buttonIcon} />}
              {isFavorited ? 'Unfavorite' : 'Add to Favorites'}
            </button>
            <button
              style={{ ...styles.button, ...styles.readerButton }}
              onClick={handleToggleReader}
            >
              {readerMode ? <FaAlignLeft style={styles.buttonIcon} /> : <FaBookOpen style={styles.buttonIcon} />}
              {readerMode ? 'Show Summary' : 'Reader Mode'}
            </button>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...styles.button, ...styles.visitButton }}
            >
              <FaExternalLinkAlt style={styles.buttonIcon} />
              Visit Original
            </a>
          </div>
          <h2 style={styles.title}>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              {article.title}
            </a>
          </h2>
          <div style={styles.meta}>
            <span>{article.feedTitle || 'Unknown Feed'}</span>
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
              {readerLoading && (
                <div style={styles.readerStatus}>Loading article…</div>
              )}
              {!readerLoading && readerError && (
                <div style={styles.readerStatus}>
                  <p>{readerError}</p>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...styles.button, ...styles.visitButton, display: 'inline-flex', marginTop: '1rem' }}
                  >
                    <FaExternalLinkAlt style={styles.buttonIcon} />
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
        </div>
      </div>
      <style>{`
        .fo-reader-content img { max-width: 100%; height: auto; border-radius: 6px; margin: 0.5rem 0; }
        .fo-reader-content a { color: ${isDarkMode ? '#5ba3ff' : '#0066cc'}; }
        .fo-reader-content figure { margin: 1rem 0; }
        .fo-reader-content figcaption { font-size: 0.9rem; color: ${isDarkMode ? '#9a9a9a' : '#888'}; }
        .fo-reader-content pre { overflow-x: auto; padding: 1rem; border-radius: 6px; background: ${isDarkMode ? '#1a1a1a' : '#f5f5f5'}; }
        .fo-reader-content code { font-family: monospace; }
        .fo-reader-content blockquote { border-left: 3px solid ${isDarkMode ? '#555' : '#ccc'}; margin: 1rem 0; padding-left: 1rem; color: ${isDarkMode ? '#b0b0b0' : '#666'}; }
        .fo-reader-content h1, .fo-reader-content h2, .fo-reader-content h3 { line-height: 1.3; margin: 1.5rem 0 0.75rem; }
        .fo-reader-content table { max-width: 100%; display: block; overflow-x: auto; }
      `}</style>
    </div>
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

export default ArticleModal;
