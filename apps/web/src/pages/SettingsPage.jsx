import React, { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';

const SettingsPage = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        navigate('/');
      } else {
        setUser(currentUser);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth, navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
      alert('Failed to logout: ' + error.message);
    }
  };

  const styles = {
    container: {
      padding: '2rem',
      maxWidth: '800px',
      margin: '2rem auto',
    },
    card: {
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '2rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      marginBottom: '2rem',
    },
    heading: {
      color: '#333',
      marginBottom: '1.5rem',
      fontSize: '1.8rem',
      fontWeight: 'bold',
    },
    sectionHeading: {
      color: '#555',
      marginBottom: '1rem',
      fontSize: '1.3rem',
      fontWeight: '600',
    },
    infoRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '0.75rem 0',
      borderBottom: '1px solid #eee',
    },
    label: {
      fontWeight: '600',
      color: '#666',
    },
    value: {
      color: '#333',
    },
    button: {
      padding: '0.75rem 2rem',
      backgroundColor: '#FF6B35',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: '600',
      transition: 'background-color 0.3s',
    },
    dangerButton: {
      backgroundColor: '#dc3545',
    },
    loadingSpinner: {
      border: '4px solid #f3f3f3',
      borderTop: '4px solid #FF6B35',
      borderRadius: '50%',
      width: '40px',
      height: '40px',
      animation: 'spin 1s linear infinite',
      margin: '2rem auto',
    },
  };

  if (loading) {
    return (
      <div>
        <Navigation />
        <div style={styles.container}>
          <div style={styles.loadingSpinner}></div>
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation />
      <div style={styles.container}>
        <h1 style={styles.heading}>Settings</h1>

        <div style={styles.card}>
          <h2 style={styles.sectionHeading}>Account Information</h2>
          <div style={styles.infoRow}>
            <span style={styles.label}>Email:</span>
            <span style={styles.value}>{user?.email}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Account Created:</span>
            <span style={styles.value}>
              {user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionHeading}>Actions</h2>
          <button
            onClick={handleLogout}
            style={{ ...styles.button, ...styles.dangerButton }}
            onMouseOver={(e) => (e.target.style.backgroundColor = '#c82333')}
            onMouseOut={(e) => (e.target.style.backgroundColor = '#dc3545')}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
