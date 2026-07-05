import React from 'react';
import { LuX } from 'react-icons/lu';
import { useTheme } from '../contexts/ThemeContext';
import { getTokens } from '../styles/tokens';
import ArticleReader from './ArticleReader';

const ArticleModal = ({ article, onClose, onMarkAsRead, onToggleFavorite, isRead, isFavorited }) => {
  const { isDarkMode } = useTheme();
  const { color, radius, shadow } = getTokens(isDarkMode);

  const styles = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: color.overlay,
      backdropFilter: 'blur(3px)',
      WebkitBackdropFilter: 'blur(3px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      padding: '1rem',
    },
    modal: {
      backgroundColor: color.surface,
      borderRadius: radius.lg,
      maxWidth: '800px',
      width: '100%',
      maxHeight: '90vh',
      overflow: 'auto',
      border: `1px solid ${color.border}`,
      boxShadow: shadow.lg,
      position: 'relative',
    },
    closeButton: {
      position: 'absolute',
      top: '1rem',
      right: '1rem',
      backgroundColor: color.surface2,
      border: 'none',
      cursor: 'pointer',
      padding: 0,
      color: color.textMuted,
      zIndex: 10,
      width: '2.5rem',
      height: '2.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '50%',
      fontSize: '1.1rem',
      transition: 'background-color 0.2s, color 0.2s',
    },
    content: {
      padding: '2rem',
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
            e.currentTarget.style.backgroundColor = color.surfaceHover;
            e.currentTarget.style.color = color.text;
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = color.surface2;
            e.currentTarget.style.color = color.textMuted;
          }}
          aria-label="Close"
        >
          <LuX />
        </button>
        <div style={styles.content}>
          <ArticleReader
            article={article}
            onMarkAsRead={onMarkAsRead}
            onToggleFavorite={onToggleFavorite}
            isRead={isRead}
            isFavorited={isFavorited}
          />
        </div>
      </div>
    </div>
  );
};

export default ArticleModal;
