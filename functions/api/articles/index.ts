/**
 * /api/articles
 * GET: List articles with smart refresh logic
 */

import { requireAuth, getFirebaseConfig } from '../../lib/auth';
import { listDocuments } from '../../lib/firebase-rest';

interface GetArticlesQuery {
  feedId?: string;
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

/**
 * GET /api/articles
 * Get articles for authenticated user
 * Implements smart refresh: triggers refresh if last fetch > 6 hours ago
 */
export async function onRequestGet(context: any): Promise<Response> {
  try {
    const { request, env } = context;

    // Require authentication
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { uid, idToken } = authResult;

    // Parse query parameters
    const url = new URL(request.url);
    const feedId = url.searchParams.get('feedId');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';

    const config = getFirebaseConfig(env);

    // Smart refresh logic: check if we need to refresh
    const shouldRefresh = await checkShouldRefresh(uid, idToken, config);

    // Get all articles (REST API limitation: complex queries are difficult)
    const allArticles = await listDocuments(
      `users/${uid}/articles`,
      idToken,
      config,
      1000 // Get up to 1000 articles
    );

    // Filter non-expired articles
    const now = new Date();
    let articles = allArticles.filter(article => {
      if (!article.expiresAt) return false;
      const expiresAt = new Date(article.expiresAt);
      return expiresAt > now;
    });

    // Filter by feed if specified
    if (feedId) {
      articles = articles.filter(article => article.feedId === feedId);
    }

    // Get read articles to mark isRead flag
    const readArticles = await listDocuments(
      `users/${uid}/readArticles`,
      idToken,
      config,
      1000
    );
    const readArticleIds = new Set(readArticles.map(doc => doc.id));

    // Add isRead flag to all articles
    articles = articles.map(article => ({
      ...article,
      isRead: readArticleIds.has(article.id),
    }));

    // Filter by unread if specified
    if (unreadOnly) {
      articles = articles.filter(article => !article.isRead);
    }

    // Sort by publishedAt descending
    articles.sort((a, b) => {
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bTime - aTime;
    });

    // Apply pagination
    const paginatedArticles = articles.slice(offset, offset + limit);

    return new Response(
      JSON.stringify({
        articles: paginatedArticles,
        shouldRefresh,
        hasMore: articles.length > offset + limit,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Get articles error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get articles' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Check if feeds should be refreshed (last fetch > 6 hours ago)
 */
async function checkShouldRefresh(
  uid: string,
  idToken: string,
  config: any
): Promise<boolean> {
  try {
    const feeds = await listDocuments(
      `users/${uid}/feeds`,
      idToken,
      config,
      100
    );

    if (feeds.length === 0) {
      return false; // No feeds to refresh
    }

    // Find the most recently fetched feed
    const feedsWithFetchTime = feeds.filter(feed => feed.lastFetchedAt);

    if (feedsWithFetchTime.length === 0) {
      return true; // Never fetched, should refresh
    }

    // Get the most recent lastFetchedAt
    const mostRecentFetch = feedsWithFetchTime.reduce((latest, feed) => {
      const fetchTime = new Date(feed.lastFetchedAt).getTime();
      return fetchTime > latest ? fetchTime : latest;
    }, 0);

    if (mostRecentFetch === 0) {
      return true;
    }

    // Refresh if more than 6 hours ago
    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
    return mostRecentFetch < sixHoursAgo;
  } catch (error) {
    console.error('Check refresh error:', error);
    return false;
  }
}
