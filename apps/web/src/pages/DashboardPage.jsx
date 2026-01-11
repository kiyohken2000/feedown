import React, { useEffect, useState, useMemo } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

// sharedパッケージからAPIクライアントとエンドポイントをインポート
import { createApiClient, FeedOwnAPI } from '@feedown/shared';

const DashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [articles, setArticles] = useState([]); // 記事データ用のステート
  const [articlesLoading, setArticlesLoading] = useState(false); // 記事フェッチ中のローディング
  const [articlesError, setArticlesError] = useState(null); // 記事フェッチエラー
  const navigate = useNavigate();
  const auth = getAuth();

  // APIクライアントのインスタンスを作成 (useMemoでメモ化)
  const apiClient = useMemo(() => createApiClient(
    import.meta.env.VITE_API_BASE_URL || '/api',
    async () => {
      if (auth.currentUser) {
        return auth.currentUser.getIdToken();
      }
      return null;
    }
  ), [auth]);

  // FeedOwnAPIのインスタンスを作成
  const api = useMemo(() => new FeedOwnAPI(apiClient), [apiClient]);

  useEffect(() => {
    const fetchArticles = async () => {
      setArticlesLoading(true);
      setArticlesError(null);
      try {
        const response = await api.articles.list(); // api.articles.list()を呼び出す
        if (response.success) {
          setArticles(response.data.articles || []); // 記事データをセット
        } else {
          throw new Error(response.error);
        }
      } catch (error) {
        console.error('Failed to fetch articles:', error);
        setArticlesError('Failed to load articles.');
      } finally {
        setArticlesLoading(false);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        navigate('/');
      } else {
        setUser(currentUser);
        setLoading(false);
        fetchArticles();
      }
    });

    return () => unsubscribe();
  }, [auth, navigate, api]);

  if (loading) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '50px auto', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h1>Dashboard Page</h1>
      <p>Welcome to your dashboard, {user?.email}!</p>

      <h2>Your Articles</h2>
      {articlesLoading && <p>Loading articles...</p>}
      {articlesError && <p style={{ color: 'red' }}>{articlesError}</p>}
      {articles.length > 0 ? (
        <ul>
          {articles.map((article) => (
            <li key={article.id} style={{ marginBottom: '10px', border: '1px solid #eee', padding: '10px' }}>
              <h3>{article.title}</h3>
              <p>{article.description}</p>
              <a href={article.link} target="_blank" rel="noopener noreferrer">Read more</a>
            </li>
          ))}
        </ul>
      ) : (
        !articlesLoading && !articlesError && <p>No articles found. Add some feeds!</p>
      )}
    </div>
  );
};

export default DashboardPage;
