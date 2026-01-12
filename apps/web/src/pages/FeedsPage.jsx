import React, { useEffect, useState, useMemo } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { createApiClient, FeedOwnAPI } from '@feedown/shared';
import Navigation from '../components/Navigation';
import { useTheme } from '../contexts/ThemeContext';

// Recommended feeds
const RECOMMENDED_FEEDS = [
  { name: 'AFP', url: 'http://feeds.afpbb.com/rss/afpbb/afpbbnews' },
  { name: 'BBC', url: 'http://feeds.bbci.co.uk/japanese/rss.xml' },
  { name: 'CNN', url: 'http://feeds.cnn.co.jp/rss/cnn/cnn.rdf' },
  { name: 'Rocket News 24', url: 'http://feeds.rocketnews24.com/rocketnews24' },
  { name: 'Weekly ASCII Plus', url: 'http://weekly.ascii.jp/cate/1/rss.xml' },
  { name: 'National Geographic', url: 'http://nationalgeographic.jp/nng/rss/index.rdf' },
  { name: 'Lifehacker', url: 'http://www.lifehacker.jp/index.xml' },
  { name: 'Reuters', url: 'http://feeds.reuters.com/reuters/JPTopNews?format=xml' },
  { name: 'GIGAZINE', url: 'https://gigazine.net/news/rss_2.0/' },
  { name: 'Gizmodo', url: 'http://feeds.gizmodo.jp/rss/gizmodo/index.xml' },
  { name: 'CNET Japan', url: 'http://feed.japan.cnet.com/rss/index.rdf' },
  { name: 'AAPL Ch.', url: 'http://applech2.com/index.rdf' },
  { name: 'Kitamori Kawaraban', url: 'https://northwood.blog.fc2.com/?xml' },
];

const FeedsPage = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [feeds, setFeeds] = useState([]);
  const [feedsLoading, setFeedsLoading] = useState(false);
  const [feedsError, setFeedsError] = useState(null);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [addingFeed, setAddingFeed] = useState(false);
  const [addingRecommended, setAddingRecommended] = useState({});
  const [draggedIndex, setDraggedIndex] = useState(null);
  const navigate = useNavigate();
  const auth = getAuth();
  const { isDarkMode } = useTheme();

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

    setAddingFeed(true);
    try {
      const response = await api.feeds.add(newFeedUrl);
      if (response.success) {
        setNewFeedUrl('');
        fetchFeeds();
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      alert('Failed to add feed: ' + error.message);
    } finally {
      setAddingFeed(false);
    }
  };

  const handleAddRecommendedFeed = async (feedUrl, feedName) => {
    // Check if already added
    const alreadyAdded = feeds.some(feed => feed.url === feedUrl);
    if (alreadyAdded) {
      alert(`${feedName} is already in your feed list.`);
      return;
    }

    setAddingRecommended(prev => ({ ...prev, [feedUrl]: true }));
    try {
      const response = await api.feeds.add(feedUrl);
      if (response.success) {
        await fetchFeeds();
        alert(`${feedName} has been added successfully!`);
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      alert('Failed to add feed: ' + error.message);
    } finally {
      setAddingRecommended(prev => ({ ...prev, [feedUrl]: false }));
    }
  };

  const handleDeleteFeed = async (feedId) => {
    if (!window.confirm('Are you sure you want to delete this feed?')) return;

    try {
      const response = await api.feeds.delete(feedId);
      if (response.success) {
        fetchFeeds();
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      alert('Failed to delete feed: ' + error.message);
    }
  };

  const isFeedAdded = (feedUrl) => {
    return feeds.some(feed => feed.url === feedUrl);
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    // Reorder feeds array
    const newFeeds = [...feeds];
    const [draggedFeed] = newFeeds.splice(draggedIndex, 1);
    newFeeds.splice(dropIndex, 0, draggedFeed);

    // Update UI optimistically
    setFeeds(newFeeds);
    setDraggedIndex(null);

    // Update order field for all feeds
    try {
      await Promise.all(
        newFeeds.map((feed, index) =>
          api.feeds.update(feed.id, { order: index })
        )
      );
    } catch (error) {
      console.error('Failed to update feed order:', error);
      // Revert on error
      fetchFeeds();
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const styles = {
    container: {
      padding: '2rem',
      maxWidth: '900px',
      margin: '2rem auto',
    },
    heading: {
      color: isDarkMode ? '#e0e0e0' : '#333',
      marginBottom: '2rem',
      fontSize: '2rem',
      fontWeight: 'bold',
    },
    card: {
      backgroundColor: isDarkMode ? '#2d2d2d' : 'white',
      borderRadius: '8px',
      padding: '2rem',
      boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.1)',
      marginBottom: '2rem',
    },
    sectionHeading: {
      color: isDarkMode ? '#b0b0b0' : '#555',
      marginBottom: '1rem',
      fontSize: '1.3rem',
      fontWeight: '600',
    },
    form: {
      display: 'flex',
      gap: '1rem',
      marginBottom: '1rem',
    },
    input: {
      flex: 1,
      padding: '0.75rem',
      border: isDarkMode ? '2px solid #444' : '2px solid #e0e0e0',
      borderRadius: '5px',
      fontSize: '1rem',
      transition: 'border-color 0.3s',
      backgroundColor: isDarkMode ? '#1a1a1a' : 'white',
      color: isDarkMode ? '#e0e0e0' : '#333',
    },
    button: {
      padding: '0.75rem 1.5rem',
      backgroundColor: '#FF6B35',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: '600',
      transition: 'background-color 0.3s',
    },
    feedsList: {
      display: 'grid',
      gap: '0.75rem',
    },
    feedItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem',
      backgroundColor: isDarkMode ? '#1a1a1a' : '#f9f9f9',
      borderRadius: '5px',
      border: isDarkMode ? '1px solid #444' : '1px solid #e0e0e0',
      cursor: 'move',
      transition: 'all 0.2s',
    },
    feedItemDragging: {
      opacity: 0.5,
      transform: 'scale(0.98)',
    },
    dragHandle: {
      fontSize: '1.2rem',
      color: isDarkMode ? '#b0b0b0' : '#999',
      cursor: 'grab',
      marginRight: '0.75rem',
      userSelect: 'none',
      flexShrink: 0,
    },
    feedInfo: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
    },
    favicon: {
      width: '24px',
      height: '24px',
      borderRadius: '3px',
      flexShrink: 0,
    },
    feedContent: {
      flex: 1,
      minWidth: 0,
    },
    feedTitle: {
      fontWeight: '600',
      color: isDarkMode ? '#e0e0e0' : '#333',
      marginBottom: '0.25rem',
    },
    feedUrl: {
      fontSize: '0.85rem',
      color: isDarkMode ? '#b0b0b0' : '#999',
    },
    deleteButton: {
      padding: '0.5rem 1rem',
      backgroundColor: '#dc3545',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: '0.9rem',
      fontWeight: '600',
      transition: 'background-color 0.3s',
    },
    noFeeds: {
      textAlign: 'center',
      padding: '2rem',
      color: isDarkMode ? '#b0b0b0' : '#999',
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
    recommendedGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '1rem',
    },
    recommendedItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem',
      backgroundColor: isDarkMode ? '#1a1a1a' : '#f9f9f9',
      borderRadius: '5px',
      border: isDarkMode ? '1px solid #444' : '1px solid #e0e0e0',
      gap: '0.75rem',
    },
    recommendedName: {
      flex: 1,
      fontWeight: '600',
      color: isDarkMode ? '#e0e0e0' : '#333',
      fontSize: '0.95rem',
    },
    addButton: {
      padding: '0.5rem 1rem',
      backgroundColor: '#28a745',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      fontSize: '0.9rem',
      fontWeight: '600',
      transition: 'background-color 0.3s',
      flexShrink: 0,
    },
    addButtonAdded: {
      backgroundColor: '#6c757d',
      cursor: 'not-allowed',
    },
  };

  if (loading) {
    return (
      <div>
        <Navigation />
        <div style={styles.container}>
          <div style={styles.loadingSpinner}></div>
          <p>Loading feeds...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation />
      <div style={styles.container}>
        <h1 style={styles.heading}>Manage Feeds</h1>

        <div style={styles.card}>
          <h2 style={styles.sectionHeading}>Add New Feed</h2>
          <form onSubmit={handleAddFeed} style={styles.form}>
            <input
              type="url"
              value={newFeedUrl}
              onChange={(e) => setNewFeedUrl(e.target.value)}
              placeholder="Enter RSS feed URL (e.g., https://example.com/feed.xml)"
              style={styles.input}
              required
              disabled={addingFeed}
            />
            <button type="submit" style={styles.button} disabled={addingFeed}>
              {addingFeed ? 'Adding...' : 'Add Feed'}
            </button>
          </form>
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionHeading}>Recommended Feeds</h2>
          <div style={styles.recommendedGrid}>
            {RECOMMENDED_FEEDS.map((feed) => {
              const isAdded = isFeedAdded(feed.url);
              const isAdding = addingRecommended[feed.url];
              return (
                <div key={feed.url} style={styles.recommendedItem}>
                  <div style={styles.recommendedName}>{feed.name}</div>
                  <button
                    onClick={() => handleAddRecommendedFeed(feed.url, feed.name)}
                    style={{
                      ...styles.addButton,
                      ...(isAdded ? styles.addButtonAdded : {}),
                    }}
                    disabled={isAdded || isAdding}
                    onMouseOver={(e) => {
                      if (!isAdded && !isAdding) {
                        e.target.style.backgroundColor = '#218838';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!isAdded && !isAdding) {
                        e.target.style.backgroundColor = '#28a745';
                      }
                    }}
                  >
                    {isAdding ? 'Adding...' : isAdded ? 'Added' : 'Add'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionHeading}>Your Feeds ({feeds.length})</h2>

          {feedsLoading && (
            <div style={{ textAlign: 'center' }}>
              <div style={styles.loadingSpinner}></div>
              <p>Loading feeds...</p>
            </div>
          )}

          {feedsError && (
            <p style={{ color: 'red', textAlign: 'center' }}>{feedsError}</p>
          )}

          {!feedsLoading && !feedsError && (
            <div style={styles.feedsList}>
              {feeds.length > 0 ? (
                feeds.map((feed, index) => (
                  <div
                    key={feed.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    style={{
                      ...styles.feedItem,
                      ...(draggedIndex === index ? styles.feedItemDragging : {}),
                    }}
                  >
                    <div style={styles.dragHandle}>☰</div>
                    <div style={styles.feedInfo}>
                      {feed.faviconUrl && (
                        <img
                          src={feed.faviconUrl}
                          alt=""
                          style={styles.favicon}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )}
                      <div style={styles.feedContent}>
                        <div style={styles.feedTitle}>{feed.title || 'Untitled Feed'}</div>
                        <div style={styles.feedUrl}>{feed.url}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteFeed(feed.id)}
                      style={styles.deleteButton}
                      onMouseOver={(e) => (e.target.style.backgroundColor = '#c82333')}
                      onMouseOut={(e) => (e.target.style.backgroundColor = '#dc3545')}
                    >
                      Delete
                    </button>
                  </div>
                ))
              ) : (
                <div style={styles.noFeeds}>
                  <p>No feeds added yet.</p>
                  <p>Add your first RSS feed using the form above!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedsPage;
