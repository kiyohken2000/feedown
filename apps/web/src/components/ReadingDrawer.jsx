import React from 'react';
import { LuX } from 'react-icons/lu';
import { useTheme } from '../contexts/ThemeContext';
import { getTokens } from '../styles/tokens';
import ArticleReader from './ArticleReader';

// Feedly-style slide-over drawer used on wide screens. Covers most of the
// viewport from the right, dimming the list behind it. Narrow screens use
// ArticleModal instead.
const ReadingDrawer = ({ article, onClose, onMarkAsRead, onToggleFavorite, isRead, isFavorited }) => {
  const { isDarkMode } = useTheme();
  const { color, shadow } = getTokens(isDarkMode);

  const styles = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: color.overlay,
      backdropFilter: 'blur(2px)',
      WebkitBackdropFilter: 'blur(2px)',
      display: 'flex',
      justifyContent: 'flex-end',
      zIndex: 1000,
      animation: 'fadeIn 0.2s ease',
    },
    drawer: {
      position: 'relative',
      width: 'clamp(600px, 80vw, 1200px)',
      height: '100%',
      backgroundColor: color.surface,
      borderLeft: `1px solid ${color.border}`,
      boxShadow: shadow.lg,
      overflowY: 'auto',
      animation: 'fo-slide-in-right 0.24s ease',
    },
    bar: {
      position: 'sticky',
      top: 0,
      zIndex: 5,
      display: 'flex',
      justifyContent: 'flex-end',
      padding: '0.85rem 0.85rem 0',
      backgroundColor: color.surface,
    },
    content: {
      padding: '0.5rem clamp(1.5rem, 5vw, 3.5rem) 2.75rem',
      maxWidth: '820px',
      margin: '0 auto',
    },
    close: {
      backgroundColor: color.surface2,
      color: color.textMuted,
      border: 'none',
      cursor: 'pointer',
      width: '2.5rem',
      height: '2.5rem',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.1rem',
    },
  };

  return (
    <div style={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside style={styles.drawer}>
        <div style={styles.bar}>
          <button
            style={styles.close}
            onClick={onClose}
            aria-label="Close reading pane"
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = color.surfaceHover; e.currentTarget.style.color = color.text; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = color.surface2; e.currentTarget.style.color = color.textMuted; }}
          >
            <LuX />
          </button>
        </div>
        <div style={styles.content}>
          <ArticleReader
            article={article}
            onMarkAsRead={onMarkAsRead}
            onToggleFavorite={onToggleFavorite}
            isRead={isRead}
            isFavorited={isFavorited}
          />
        </div>
      </aside>
    </div>
  );
};

export default ReadingDrawer;
