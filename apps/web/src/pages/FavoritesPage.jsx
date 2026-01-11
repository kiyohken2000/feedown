import React, { useEffect, useState, useMemo } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';

const FavoritesPage = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesError, setFavoritesError] = useState(null);
  const navigate = useNavigate();
  const auth = getAuth();

  const apiClient = useMemo(() => createApiClient(
    import.meta.env.VITE_API_BASE_URL || '/api',
    async () => auth.currentUser ? auth.currentUser.getIdToken() : null
  ), [auth]);

  const api = useMemo(() => new FeedOwnAPI(apiClient), [apiClient]);

  useEffect(() => {
    const fetchFavorites = async () => {
      setFavoritesLoading(true);
      setFavoritesError(null);
      try {
        const response = await api.favorites.list();
        if (response.success) {
          setFavorites(response.data.favorites || []);
        } else {
          throw new Error(response.error);
        }
      } catch (error) {
        console.error('Failed to fetch favorites:', error);
        setFavoritesError('Failed to load favorites.');
      } finally {
        setFavoritesLoading(false);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        navigate('/');
      } else {
        setUser(currentUser);
        setLoading(false);
        fetchFavorites();
      }
    });

    return () => unsubscribe();
  }, [auth, navigate, api]);

  if (loading) {
    return <div>Loading favorites page...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '50px auto', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h1>Favorites Page</h1>
      <p>Welcome, {user?.email}!</p>

      <h2>Your Favorite Articles</h2>
      {favoritesLoading && <p>Loading favorites...</p>}
      {favoritesError && <p style={{ color: 'red' }}>{favoritesError}</p>}
      {favorites.length > 0 ? (
        <ul>
          {favorites.map((favorite) => (
            <li key={favorite.articleId} style={{ marginBottom: '10px', border: '1px solid #eee', padding: '10px' }}>
              <h3>{favorite.articleTitle}</h3>
              <p>{favorite.articleDescription}</p>
              <a href={favorite.articleLink} target="_blank" rel="noopener noreferrer">Read more</a>
            </li>
          ))}
        </ul>
      ) : (
        !favoritesLoading && !favoritesError && <p>No favorite articles found.</p>
      )}
    </div>
  );
};

export default FavoritesPage;
