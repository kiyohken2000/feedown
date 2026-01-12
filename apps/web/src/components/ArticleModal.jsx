import React from 'react';

const ArticleModal = ({ article, onClose, onMarkAsRead, onToggleFavorite, isRead, isFavorited }) => {
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
      backgroundColor: 'white',
      borderRadius: '12px',
      maxWidth: '800px',
      width: '100%',
      maxHeight: '90vh',
      overflow: 'auto',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      position: 'relative',
    },
    closeButton: {
      position: 'sticky',
      top: 0,
      right: 0,
      background: 'white',
      border: 'none',
      fontSize: '2rem',
      cursor: 'pointer',
      padding: '1rem 1.5rem',
      color: '#666',
      zIndex: 10,
      textAlign: 'right',
      borderBottom: '1px solid #eee',
    },
    content: {
      padding: '2rem',
    },
    image: {
      width: '100%',
      height: 'auto',
      borderRadius: '8px',
      marginBottom: '1.5rem',
    },
    title: {
      fontSize: '2rem',
      fontWeight: 'bold',
      color: '#333',
      marginBottom: '1rem',
      lineHeight: '1.3',
    },
    meta: {
      display: 'flex',
      gap: '1rem',
      fontSize: '0.9rem',
      color: '#999',
      marginBottom: '1.5rem',
      flexWrap: 'wrap',
    },
    description: {
      fontSize: '1.1rem',
      lineHeight: '1.8',
      color: '#444',
      marginBottom: '2rem',
      whiteSpace: 'pre-wrap',
    },
    actions: {
      display: 'flex',
      gap: '1rem',
      marginTop: '2rem',
      paddingTop: '1.5rem',
      borderTop: '1px solid #eee',
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
      display: 'inline-block',
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
        <button style={styles.closeButton} onClick={onClose}>
          ×
        </button>
        <div style={styles.content}>
          {article.imageUrl && (
            <img src={article.imageUrl} alt={article.title} style={styles.image} />
          )}
          <h2 style={styles.title}>{article.title}</h2>
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
          <div style={styles.description}>
            {article.description || 'No content available'}
          </div>
          <div style={styles.actions}>
            <button
              style={{ ...styles.button, ...styles.readButton }}
              onClick={onMarkAsRead}
              disabled={isRead}
            >
              {isRead ? '✓ Marked as Read' : 'Mark as Read'}
            </button>
            <button
              style={{ ...styles.button, ...styles.favoriteButton }}
              onClick={onToggleFavorite}
            >
              {isFavorited ? '★ Unfavorite' : '☆ Add to Favorites'}
            </button>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...styles.button, ...styles.visitButton }}
            >
              Visit Original →
            </a>
          </div>
        </div>
      </div>
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
