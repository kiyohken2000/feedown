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

    // Fetch feeds, articles, and read articles in parallel for better performance
    const [shouldRefresh, allFeeds, allArticles, readArticles] = await Promise.all([
      checkShouldRefresh(uid, idToken, config),
      listDocuments(`users/${uid}/feeds`, idToken, config, 100),
      listDocuments(`users/${uid}/articles`, idToken, config, 1000),
      listDocuments(`users/${uid}/readArticles`, idToken, config, 1000),
    ]);

    console.log(`[articles/index] Fetched ${allFeeds.length} feeds, ${allArticles.length} articles, ${readArticles.length} read articles`);
    console.log(`[articles/index] Feed IDs:`, allFeeds.map(f => f.id));

    const validFeedIds = new Set(allFeeds.map(feed => feed.id));
    const readArticleIds = new Set(readArticles.map(doc => doc.id));

    // Filter non-expired articles and articles from deleted feeds
    const now = new Date();
    console.log(`[articles/index] Before filtering: ${allArticles.length} articles`);

    let articles = allArticles.filter(article => {
      if (!article.expiresAt) {
        console.log(`[articles/index] Article ${article.id} has no expiresAt`);
        return false;
      }
      const expiresAt = new Date(article.expiresAt);
      if (expiresAt <= now) {
        console.log(`[articles/index] Article ${article.id} expired at ${expiresAt}`);
        return false;
      }
      // Exclude articles from deleted feeds
      if (!validFeedIds.has(article.feedId)) {
        console.log(`[articles/index] Article ${article.id} from deleted feed ${article.feedId}`);
        return false;
      }
      return true;
    });

    console.log(`[articles/index] After filtering: ${articles.length} articles`);

    // Group articles by feedId for debugging
    const articlesByFeed: Record<string, number> = {};
    articles.forEach(article => {
      articlesByFeed[article.feedId] = (articlesByFeed[article.feedId] || 0) + 1;
    });
    console.log(`[articles/index] Articles by feed:`, articlesByFeed);

    // Filter by feed if specified
    if (feedId) {
      articles = articles.filter(article => article.feedId === feedId);
    }

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
