import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import logoIcon from '../assets/images/icon.png';

const Navigation = ({ unreadCount = 0 }) => {
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/feeds', label: 'Feeds' },
    { path: '/favorites', label: 'Favorites' },
    { path: '/settings', label: 'Settings' },
  ];

  const styles = {
    nav: {
      backgroundColor: '#FF6B35',
      padding: '1rem 2rem',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
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
      color: 'white',
      fontSize: '1.5rem',
      fontWeight: 'bold',
      textDecoration: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
    },
    brandLogo: {
      width: '32px',
      height: '32px',
      borderRadius: '6px',
    },
    navList: {
      display: 'flex',
      listStyle: 'none',
      margin: 0,
      padding: 0,
      gap: '2rem',
    },
    navItem: {
      margin: 0,
    },
    navLink: {
      color: 'white',
      textDecoration: 'none',
      padding: '0.5rem 1rem',
      borderRadius: '4px',
      transition: 'background-color 0.3s',
    },
    activeNavLink: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    unreadBadge: {
      backgroundColor: 'white',
      color: '#FF6B35',
      padding: '0.15rem 0.5rem',
      borderRadius: '12px',
      fontSize: '0.85rem',
      fontWeight: '700',
      marginLeft: '0.5rem',
      display: 'inline-block',
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
          {navItems.map((item) => (
            <li key={item.path} style={styles.navItem}>
              <Link
                to={item.path}
                style={{
                  ...styles.navLink,
                  ...(location.pathname === item.path ? styles.activeNavLink : {}),
                }}
              >
                {item.label}
                {item.path === '/dashboard' && unreadCount > 0 && (
                  <span style={styles.unreadBadge}>{unreadCount}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};

export default Navigation;
