import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LuNewspaper, LuStar, LuRss, LuSettings } from 'react-icons/lu';
import logoIcon from '../assets/images/icon.png';
import { useTheme } from '../contexts/ThemeContext';
import { getTokens } from '../styles/tokens';

const Navigation = ({ unreadCount = 0 }) => {
  const location = useLocation();
  const { isDarkMode } = useTheme();
  const { color, radius, shadow } = getTokens(isDarkMode);

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LuNewspaper },
    { path: '/favorites', label: 'Favorites', icon: LuStar },
    { path: '/feeds', label: 'Feeds', icon: LuRss },
    { path: '/settings', label: 'Settings', icon: LuSettings },
  ];

  const styles = {
    nav: {
      backgroundColor: color.surface,
      borderBottom: `1px solid ${color.border}`,
      padding: '0.75rem 2rem',
      boxShadow: shadow.sm,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    },
    navContainer: {
      maxWidth: '1200px',
      margin: '0 auto',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    brand: {
      color: color.text,
      fontSize: '1.35rem',
      fontWeight: 700,
      letterSpacing: '-0.02em',
      textDecoration: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: '0.6rem',
    },
    brandLogo: {
      width: '30px',
      height: '30px',
      borderRadius: '8px',
    },
    navList: {
      display: 'flex',
      listStyle: 'none',
      margin: 0,
      padding: 0,
      gap: '0.35rem',
      alignItems: 'center',
    },
    navItem: {
      margin: 0,
    },
    navLink: {
      color: color.textMuted,
      textDecoration: 'none',
      padding: '0.5rem 0.85rem',
      borderRadius: radius.sm,
      fontSize: '0.95rem',
      fontWeight: 600,
      transition: 'background-color 0.2s, color 0.2s',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    navIcon: {
      fontSize: '0.95rem',
    },
    activeNavLink: {
      backgroundColor: color.accentSoft,
      color: color.accent,
    },
    unreadBadge: {
      backgroundColor: color.accent,
      color: color.onAccent,
      padding: '0.1rem 0.45rem',
      borderRadius: radius.pill,
      fontSize: '0.75rem',
      fontWeight: 700,
      marginLeft: '0.35rem',
      display: 'inline-block',
      minWidth: '1.1rem',
      textAlign: 'center',
      lineHeight: 1.5,
    },
  };

  return (
    <nav style={styles.nav}>
      <div style={styles.navContainer}>
        <Link to="/dashboard" style={styles.brand}>
          <img src={logoIcon} alt="FeedOwn" style={styles.brandLogo} />
          FeedOwn
        </Link>
        <ul style={styles.navList}>
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path} style={styles.navItem}>
                <Link
                  to={item.path}
                  style={{
                    ...styles.navLink,
                    ...(isActive ? styles.activeNavLink : {}),
                  }}
                  onMouseOver={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = color.surface2;
                      e.currentTarget.style.color = color.text;
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = color.textMuted;
                    }
                  }}
                >
                  <IconComponent style={styles.navIcon} />
                  {item.label}
                  {item.path === '/dashboard' && unreadCount > 0 && (
                    <span style={styles.unreadBadge}>{unreadCount}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};

export default Navigation;
