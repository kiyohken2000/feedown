/**
 * /api/articles
 * GET: List articles with smart refresh logic
 */
import { requireAuth, getFirebaseConfig } from '../../lib/auth';
import { listDocuments, getDocument } from '../../lib/firebase-rest';
/**
 * GET /api/articles
 * Get articles for authenticated user
 * Implements smart refresh: triggers refresh if last fetch > 6 hours ago
 * OPTIMIZED: Removed duplicate feed fetching
 */
export async function onRequestGet(context) {
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
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
        const config = getFirebaseConfig(env);
        // Fetch feeds and articles (removed duplicate feed fetch)
        const [allFeeds, allArticles] = await Promise.all([
            listDocuments(`users/${uid}/feeds`, idToken, config, 100),
            listDocuments(`users/${uid}/articles`, idToken, config, 1000),
        ]);
        console.log(`[articles/index] Fetched ${allFeeds.length} feeds, ${allArticles.length} articles`);
        console.log(`[articles/index] Feed IDs:`, allFeeds.map(f => f.id));
        // Check if should refresh based on feeds
        const shouldRefresh = checkShouldRefreshFromFeeds(allFeeds);
        const validFeedIds = new Set(allFeeds.map(feed => feed.id));
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
        const articlesByFeed = {};
        articles.forEach(article => {
            articlesByFeed[article.feedId] = (articlesByFeed[article.feedId] || 0) + 1;
        });
        console.log(`[articles/index] Articles by feed:`, articlesByFeed);
        // Filter by feed if specified
        if (feedId) {
            articles = articles.filter(article => article.feedId === feedId);
        }
        // Sort by publishedAt descending BEFORE pagination
        articles.sort((a, b) => {
            const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return bTime - aTime;
        });
        // Fetch read articles from userState document (aggregated approach - 1 read instead of 1000)
        const userState = await getDocument(`users/${uid}/userState/main`, idToken, config);
        const readArticleIds = new Set(userState?.readArticleIds || []);
        console.log(`[articles/index] Fetched userState with ${readArticleIds.size} read article IDs`);
        // Apply pagination to get only the articles we'll display
        const paginatedArticles = articles.slice(offset, offset + limit);
        // Add isRead flag to paginated articles
        let articlesWithReadStatus = paginatedArticles.map(article => ({
            ...article,
            isRead: readArticleIds.has(article.id),
        }));
        // Filter by unread if specified (after adding read status)
        if (unreadOnly) {
            articlesWithReadStatus = articlesWithReadStatus.filter(article => !article.isRead);
        }
        return new Response(JSON.stringify({
            articles: articlesWithReadStatus,
            shouldRefresh,
            hasMore: offset + limit < articles.length,
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'private, max-age=60', // Cache for 60 seconds
            },
        });
    }
    catch (error) {
        console.error('Get articles error:', error);
        return new Response(JSON.stringify({ error: 'Failed to get articles' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
/**
 * Check if feeds should be refreshed based on already-fetched feeds
 * OPTIMIZED: Takes feeds as parameter to avoid duplicate fetch
 */
function checkShouldRefreshFromFeeds(feeds) {
    try {
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
    }
    catch (error) {
        console.error('Check refresh error:', error);
        return false;
    }
}
