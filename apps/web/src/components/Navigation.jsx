import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaStar, FaRss, FaCog, FaBookmark } from 'react-icons/fa';
import logoIcon from '../assets/images/icon.png';

const Navigation = ({ unreadCount = 0 }) => {
  const location = useLocation();
  const styles = {
    nav: { backgroundColor: '#FF6B35', padding: '0 1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.15)', position: 'sticky', top: 0, zIndex: 100, height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    brand: { color: 'white', fontSize: '1.3rem', fontWeight: 'bold', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.6rem' },
    brandLogo: { width: '28px', height: '28px', borderRadius: '6px' },
    navList: { display: 'flex', listStyle: 'none', margin: 0, padding: 0, gap: '0.25rem' },
    navLink: { color: 'white', textDecoration: 'none', padding: '0.4rem 0.75rem', borderRadius: '4px', transition: 'background-color 0.2s', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' },
    activeNavLink: { backgroundColor: 'rgba(255,255,255,0.2)' },
    unreadBadge: { backgroundColor: 'rgba(0,0,0,0.22)', color: 'white', padding: '0.1rem 0.45rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '700' },
  };
  const navItems = [
    { path: '/read-later', label: 'Read Later', icon: FaBookmark },
    { path: '/favorites', label: 'Favorites', icon: FaStar },
    { path: '/feeds', label: 'Feeds', icon: FaRss },
    { path: '/settings', label: 'Settings', icon: FaCog },
  ];
  return (
    <nav style={styles.nav}>
      <Link to="/dashboard" style={styles.brand}>
        <img src={logoIcon} alt="FeedOwn" style={styles.brandLogo} />
        FeedOwn
        {unreadCount > 0 && <span style={styles.unreadBadge}>{unreadCount}</span>}
      </Link>
      <ul style={styles.navList}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.path}>
              <Link to={item.path} style={{ ...styles.navLink, ...(location.pathname === item.path ? styles.activeNavLink : {}) }}>
                <Icon />{item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
export default Navigation;
