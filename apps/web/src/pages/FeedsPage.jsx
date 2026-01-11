import React, { useEffect, useState, useMemo } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';

const FeedsPage = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [feeds, setFeeds] = useState([]);
  const [feedsLoading, setFeedsLoading] = useState(false);
  const [feedsError, setFeedsError] = useState(null);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const navigate = useNavigate();
  const auth = getAuth();

  const apiClient = useMemo(() => createApiClient(
    import.meta.env.VITE_API_BASE_URL || '/api',
    async () => auth.currentUser ? auth.currentUser.getIdToken() : null
  ), [auth]);

  const api = useMemo(() => new FeedOwnAPI(apiClient), [apiClient]);

  const fetchFeeds = async () => {
    setFeedsLoading(true);
    setFeedsError(null);
    try {
      const response = await api.feeds.list();
      if (response.success) {
        setFeeds(response.data.feeds || []);
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Failed to fetch feeds:', error);
      setFeedsError('Failed to load feeds.');
    } finally {
      setFeedsLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        navigate('/');
      } else {
        setUser(currentUser);
        setLoading(false);
        fetchFeeds();
      }
    });

    return () => unsubscribe();
  }, [auth, navigate, api]);

  const handleAddFeed = async (e) => {
    e.preventDefault();
    if (!newFeedUrl) return;

    try {
      const response = await api.feeds.add(newFeedUrl);
      if (response.success) {
        setNewFeedUrl('');
        fetchFeeds(); // リストを再取得
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      alert('Failed to add feed: ' + error.message);
    }
  };

  const handleDeleteFeed = async (feedId) => {
    if (!window.confirm('Are you sure you want to delete this feed?')) return;

    try {
      const response = await api.feeds.delete(feedId);
      if (response.success) {
        fetchFeeds(); // リストを再取得
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      alert('Failed to delete feed: ' + error.message);
    }
  };

  if (loading) {
    return <div>Loading feeds page...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '50px auto', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h1>Feeds Page</h1>
      <p>Welcome, {user?.email}!</p>

      <h2>Add New Feed</h2>
      <form onSubmit={handleAddFeed}>
        <input
          type="url"
          value={newFeedUrl}
          onChange={(e) => setNewFeedUrl(e.target.value)}
          placeholder="Enter RSS feed URL"
          style={{ width: '80%', padding: '8px', boxSizing: 'border-box' }}
        />
        <button type="submit" style={{ padding: '8px 16px', marginLeft: '10px' }}>Add</button>
      </form>

      <h2>Your Feeds</h2>
      {feedsLoading && <p>Loading feeds...</p>}
      {feedsError && <p style={{ color: 'red' }}>{feedsError}</p>}
      {feeds.length > 0 ? (
        <ul>
          {feeds.map((feed) => (
            <li key={feed.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', border: '1px solid #eee', padding: '10px' }}>
              <span>{feed.title || feed.url}</span>
              <button onClick={() => handleDeleteFeed(feed.id)} style={{ padding: '5px 10px', backgroundColor: 'red', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !feedsLoading && !feedsError && <p>No feeds found.</p>
      )}
    </div>
  );
};

export default FeedsPage;
