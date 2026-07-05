import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getTokens } from '../styles/tokens';
import logoLarge from '../assets/images/logo-lg.png';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { language } = useLanguage();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate('/dashboard');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
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

      const { error } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
      });
      if (error) throw error;
      navigate('/dashboard');
    } catch (error) {
      console.error('Quick account creation failed:', error.message);
      alert('Quick account creation failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const { color, radius, shadow } = getTokens(isDarkMode);

  const styles = {
    container: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `radial-gradient(1200px 600px at 50% -10%, ${color.accentSoft} 0%, transparent 60%), linear-gradient(180deg, ${color.appBg} 0%, ${color.surface2} 100%)`,
      padding: '2rem',
    },
    card: {
      backgroundColor: color.surface,
      padding: '3rem',
      borderRadius: radius.lg,
      boxShadow: shadow.lg,
      border: `1px solid ${color.border}`,
      maxWidth: '450px',
      width: '100%',
    },
    logo: {
      textAlign: 'center',
      marginBottom: '2rem',
    },
    logoImage: {
      width: '110px',
      height: '110px',
      margin: '0 auto 1rem',
      display: 'block',
      borderRadius: '22px',
    },
    logoText: {
      fontSize: '2.4rem',
      fontWeight: 800,
      letterSpacing: '-0.03em',
      color: color.text,
      marginBottom: '0.4rem',
    },
    tagline: {
      fontSize: '1rem',
      color: color.textMuted,
    },
    tabs: {
      display: 'inline-flex',
      width: '100%',
      marginBottom: '2rem',
      padding: '0.25rem',
      gap: '0.25rem',
      backgroundColor: color.surface2,
      borderRadius: radius.md,
      border: `1px solid ${color.border}`,
    },
    tab: {
      flex: 1,
      padding: '0.65rem',
      textAlign: 'center',
      cursor: 'pointer',
      fontWeight: 600,
      color: color.textMuted,
      borderRadius: radius.sm,
      transition: 'all 0.2s',
    },
    activeTab: {
      color: color.onAccent,
      backgroundColor: color.accent,
      boxShadow: shadow.sm,
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    },
    label: {
      fontWeight: 600,
      color: color.text,
      fontSize: '0.9rem',
    },
    input: {
      padding: '0.75rem 0.85rem',
      border: `1px solid ${color.border}`,
      borderRadius: radius.sm,
      fontSize: '1rem',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      backgroundColor: color.surface,
      color: color.text,
    },
    button: {
      padding: '0.9rem',
      backgroundColor: color.accent,
      color: color.onAccent,
      border: 'none',
      borderRadius: radius.sm,
      fontSize: '1rem',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      marginTop: '0.75rem',
      boxShadow: shadow.sm,
    },
    buttonDisabled: {
      backgroundColor: color.textFaint,
      cursor: 'not-allowed',
      boxShadow: 'none',
    },
    quickCreateButton: {
      padding: '0.9rem',
      backgroundColor: color.surface,
      color: color.text,
      border: `1px solid ${color.border}`,
      borderRadius: radius.sm,
      fontSize: '1rem',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'background-color 0.2s',
      marginTop: '0.5rem',
    },
    divider: {
      display: 'flex',
      alignItems: 'center',
      margin: '1.5rem 0',
      color: color.textFaint,
    },
    dividerLine: {
      flex: 1,
      height: '1px',
      backgroundColor: color.border,
    },
    dividerText: {
      padding: '0 1rem',
      fontSize: '0.85rem',
    },
    notice: {
      backgroundColor: color.accentSoft,
      border: `1px solid ${color.accentBorder}`,
      borderRadius: radius.sm,
      padding: '0.75rem',
      marginTop: '1rem',
      fontSize: '0.85rem',
      color: isDarkMode ? '#e6b8a3' : '#9a4a24',
    },
    backLink: {
      display: 'block',
      textAlign: 'center',
      marginTop: '1.5rem',
      color: color.textMuted,
      textDecoration: 'none',
      fontSize: '0.9rem',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <img src={logoLarge} alt="FeedOwn Logo" style={styles.logoImage} />
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
              onFocus={(e) => { e.target.style.borderColor = color.accent; e.target.style.boxShadow = `0 0 0 3px ${color.accentSoft}`; }}
              onBlur={(e) => { e.target.style.borderColor = color.border; e.target.style.boxShadow = 'none'; }}
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
              onFocus={(e) => { e.target.style.borderColor = color.accent; e.target.style.boxShadow = `0 0 0 3px ${color.accentSoft}`; }}
              onBlur={(e) => { e.target.style.borderColor = color.border; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          <button
            type="submit"
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {}),
            }}
            disabled={loading}
            onMouseOver={(e) => !loading && (e.currentTarget.style.backgroundColor = color.accentHover)}
            onMouseOut={(e) => !loading && (e.currentTarget.style.backgroundColor = color.accent)}
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
              onMouseOver={(e) => !loading && (e.currentTarget.style.backgroundColor = color.surfaceHover)}
              onMouseOut={(e) => !loading && (e.currentTarget.style.backgroundColor = color.surface)}
            >
              Quick Create Test Account
            </button>
          </>
        )}

        <div style={styles.notice}>
          {language === 'en'
            ? "If you didn't set a custom password, the default password is"
            : 'カスタムパスワードを設定していない場合、デフォルトパスワードは'}
          {' '}<strong>111111</strong>
        </div>

        <Link
          to="/"
          style={styles.backLink}
          onMouseOver={(e) => (e.currentTarget.style.color = color.accent)}
          onMouseOut={(e) => (e.currentTarget.style.color = color.textMuted)}
        >
          ← {language === 'en' ? 'Back to Home' : 'ホームに戻る'}
        </Link>
      </div>
    </div>
  );
};

export default LoginPage;
