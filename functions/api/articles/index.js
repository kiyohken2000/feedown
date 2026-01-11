/**
 * /api/articles
 * GET: List articles with smart refresh logic
 */
import { requireAuth } from '../../lib/auth';
import { getAdminFirestore } from '../../lib/firebase';
/**
 * GET /api/articles
 * Get articles for authenticated user
 * Implements smart refresh: triggers refresh if last fetch > 6 hours ago
 */
export async function onRequestGet(context) {
    try {
        const { request, env } = context;
        // Require authentication
        const authResult = await requireAuth(request, env);
        if (authResult instanceof Response) {
            return authResult;
        }
        const { uid } = authResult;
        // Parse query parameters
        const url = new URL(request.url);
        const feedId = url.searchParams.get('feedId');
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
        const db = getAdminFirestore(env);
        // Smart refresh logic: check if we need to refresh
        const shouldRefresh = await checkShouldRefresh(db, uid);
        // Build articles query
        let articlesQuery = db
            .collection('users')
            .doc(uid)
            .collection('articles')
            .where('expiresAt', '>', new Date()) // Only non-expired articles
            .orderBy('expiresAt')
            .orderBy('publishedAt', 'desc')
            .limit(limit);
        // Filter by feed if specified
        if (feedId) {
            articlesQuery = articlesQuery.where('feedId', '==', feedId);
        }
        const articlesSnapshot = await articlesQuery.get();
        // Get read articles if filtering by unread
        let readArticleIds = new Set();
        if (unreadOnly) {
            const readSnapshot = await db
                .collection('users')
                .doc(uid)
                .collection('readArticles')
                .get();
            readArticleIds = new Set(readSnapshot.docs.map(doc => doc.id));
        }
        // Map articles
        const articles = articlesSnapshot.docs
            .map(doc => ({
            id: doc.id,
            ...doc.data(),
        }))
            .filter(article => !unreadOnly || !readArticleIds.has(article.id));
        return new Response(JSON.stringify({
            articles,
            shouldRefresh,
            hasMore: articlesSnapshot.docs.length === limit,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    catch (error) {
        console.error('Get articles error:', error);
        return new Response(JSON.stringify({ error: 'Failed to get articles' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
/**
 * Check if feeds should be refreshed (last fetch > 6 hours ago)
 */
async function checkShouldRefresh(db, uid) {
    try {
        const feedsSnapshot = await db
            .collection('users')
            .doc(uid)
            .collection('feeds')
            .limit(1)
            .get();
        if (feedsSnapshot.empty) {
            return false; // No feeds to refresh
        }
        // Check the most recently fetched feed
        const feedsWithFetchTime = await db
            .collection('users')
            .doc(uid)
            .collection('feeds')
            .where('lastFetchedAt', '!=', null)
            .orderBy('lastFetchedAt', 'desc')
            .limit(1)
            .get();
        if (feedsWithFetchTime.empty) {
            return true; // Never fetched, should refresh
        }
        const lastFetchedAt = feedsWithFetchTime.docs[0].data().lastFetchedAt?.toDate();
        if (!lastFetchedAt) {
            return true;
        }
        // Refresh if more than 6 hours ago
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        return lastFetchedAt < sixHoursAgo;
    }
    catch (error) {
        console.error('Check refresh error:', error);
        return false;
    }
}
