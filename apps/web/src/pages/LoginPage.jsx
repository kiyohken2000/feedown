import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const auth = getAuth();
  const { isDarkMode } = useTheme();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        navigate('/dashboard');
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Authentication failed:', error.message);
      alert((isLogin ? 'Login' : 'Registration') + ' failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCreate = async () => {
    setLoading(true);
    try {
      const randomNum = Math.floor(Math.random() * 1000000);
      const testEmail = `test-${randomNum}@test.com`;
      const testPassword = '111111';

      await createUserWithEmailAndPassword(auth, testEmail, testPassword);
      navigate('/dashboard');
    } catch (error) {
      console.error('Quick account creation failed:', error.message);
      alert('Quick account creation failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #FF6B35 0%, #f7931e 100%)',
      padding: '2rem',
    },
    card: {
      backgroundColor: isDarkMode ? '#2d2d2d' : 'white',
      padding: '3rem',
      borderRadius: '12px',
      boxShadow: isDarkMode ? '0 10px 40px rgba(0,0,0,0.6)' : '0 10px 40px rgba(0,0,0,0.2)',
      maxWidth: '450px',
      width: '100%',
    },
    logo: {
      textAlign: 'center',
      marginBottom: '2rem',
    },
    logoText: {
      fontSize: '2.5rem',
      fontWeight: 'bold',
      color: '#FF6B35',
      marginBottom: '0.5rem',
    },
    tagline: {
      fontSize: '1rem',
      color: isDarkMode ? '#b0b0b0' : '#666',
      fontStyle: 'italic',
    },
    tabs: {
      display: 'flex',
      marginBottom: '2rem',
      borderBottom: isDarkMode ? '2px solid #444' : '2px solid #e0e0e0',
    },
    tab: {
      flex: 1,
      padding: '1rem',
      textAlign: 'center',
      cursor: 'pointer',
      fontWeight: '600',
      color: isDarkMode ? '#b0b0b0' : '#999',
      borderBottom: '3px solid transparent',
      transition: 'all 0.3s',
    },
    activeTab: {
      color: '#FF6B35',
      borderBottomColor: '#FF6B35',
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    },
    label: {
      fontWeight: '600',
      color: isDarkMode ? '#e0e0e0' : '#333',
      fontSize: '0.9rem',
    },
    input: {
      padding: '0.75rem',
      border: isDarkMode ? '2px solid #444' : '2px solid #e0e0e0',
      borderRadius: '6px',
      fontSize: '1rem',
      transition: 'border-color 0.3s',
      backgroundColor: isDarkMode ? '#1a1a1a' : 'white',
      color: isDarkMode ? '#e0e0e0' : '#333',
    },
    button: {
      padding: '1rem',
      backgroundColor: '#FF6B35',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      fontSize: '1rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'background-color 0.3s',
      marginTop: '1rem',
    },
    buttonDisabled: {
      backgroundColor: '#ccc',
      cursor: 'not-allowed',
    },
    quickCreateButton: {
      padding: '1rem',
      backgroundColor: '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      fontSize: '1rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'background-color 0.3s',
      marginTop: '0.5rem',
    },
    divider: {
      display: 'flex',
      alignItems: 'center',
      margin: '1.5rem 0',
      color: isDarkMode ? '#666' : '#999',
    },
    dividerLine: {
      flex: 1,
      height: '1px',
      backgroundColor: isDarkMode ? '#444' : '#e0e0e0',
    },
    dividerText: {
      padding: '0 1rem',
      fontSize: '0.85rem',
    },
    notice: {
      backgroundColor: isDarkMode ? '#3a3a2a' : '#fff3cd',
      border: isDarkMode ? '1px solid #666633' : '1px solid #ffc107',
      borderRadius: '6px',
      padding: '0.75rem',
      marginTop: '1rem',
      fontSize: '0.85rem',
      color: isDarkMode ? '#e0e0a0' : '#856404',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoText}>FeedOwn</div>
          <div style={styles.tagline}>Own your feeds, own your data</div>
        </div>

        <div style={styles.tabs}>
          <div
            style={{
              ...styles.tab,
              ...(isLogin ? styles.activeTab : {}),
            }}
            onClick={() => setIsLogin(true)}
          >
            Login
          </div>
          <div
            style={{
              ...styles.tab,
              ...(!isLogin ? styles.activeTab : {}),
            }}
            onClick={() => setIsLogin(false)}
          >
            Register
          </div>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              style={styles.input}
              required
              disabled={loading}
              onFocus={(e) => (e.target.style.borderColor = '#FF6B35')}
              onBlur={(e) => (e.target.style.borderColor = '#e0e0e0')}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={styles.input}
              required
              disabled={loading}
              onFocus={(e) => (e.target.style.borderColor = '#FF6B35')}
              onBlur={(e) => (e.target.style.borderColor = '#e0e0e0')}
            />
          </div>

          <button
            type="submit"
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {}),
            }}
            disabled={loading}
            onMouseOver={(e) => !loading && (e.target.style.backgroundColor = '#e55a2b')}
            onMouseOut={(e) => !loading && (e.target.style.backgroundColor = '#FF6B35')}
          >
            {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Create Account')}
          </button>
        </form>

        {!isLogin && (
          <>
            <div style={styles.divider}>
              <div style={styles.dividerLine}></div>
              <span style={styles.dividerText}>OR</span>
              <div style={styles.dividerLine}></div>
            </div>

            <button
              onClick={handleQuickCreate}
              style={{
                ...styles.quickCreateButton,
                ...(loading ? styles.buttonDisabled : {}),
              }}
              disabled={loading}
              onMouseOver={(e) => !loading && (e.target.style.backgroundColor = '#2563eb')}
              onMouseOut={(e) => !loading && (e.target.style.backgroundColor = '#3b82f6')}
            >
              Quick Create Test Account
            </button>
          </>
        )}

        <div style={styles.notice}>
          ⚠️ If you didn't set a custom password, the default password is <strong>111111</strong>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
