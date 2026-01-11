/**
 * POST /api/refresh
 * Refresh all feeds for authenticated user
 * Fetches RSS feeds via Workers, parses, and stores articles in Firestore
 */
import { requireAuth, getFirebaseConfig } from '../lib/auth';
import { listDocuments, updateDocument, setDocument, getDocument } from '../lib/firebase-rest';
/**
 * POST /api/refresh
 * Trigger feed refresh for user
 */
export async function onRequestPost(context) {
    try {
        const { request, env } = context;
        // Require authentication
        const authResult = await requireAuth(request, env);
        if (authResult instanceof Response) {
            return authResult;
        }
        const { uid, idToken } = authResult;
        const config = getFirebaseConfig(env);
        // Get all user's feeds
        const feeds = await listDocuments(`users/${uid}/feeds`, idToken, config, 100);
        if (feeds.length === 0) {
            return new Response(JSON.stringify({
                message: 'No feeds to refresh',
                stats: {
                    totalFeeds: 0,
                    successfulFeeds: 0,
                    failedFeeds: 0,
                    newArticles: 0,
                },
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        const stats = {
            totalFeeds: feeds.length,
            successfulFeeds: 0,
            failedFeeds: 0,
            newArticles: 0,
        };
        // Get Worker URL from environment
        const workerUrl = env.WORKER_URL || env.VITE_WORKER_URL;
        if (!workerUrl) {
            return new Response(JSON.stringify({ error: 'Worker URL not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
        // Process each feed
        for (const feed of feeds) {
            const feedId = feed.id;
            const feedUrl = feed.url;
            try {
                // Fetch RSS XML via Worker
                const rssResponse = await fetch(`${workerUrl}/fetch?url=${encodeURIComponent(feedUrl)}`, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'FeedOwn/1.0',
                    },
                });
                if (!rssResponse.ok) {
                    console.error(`Failed to fetch feed ${feedId}: ${rssResponse.status}`);
                    stats.failedFeeds++;
                    await updateFeedError(uid, feedId, idToken, config);
                    continue;
                }
                const xmlText = await rssResponse.text();
                // Parse RSS XML
                const parsedFeed = await parseRssXml(xmlText);
                // Store articles in Firestore
                const newArticleCount = await storeArticles(uid, feedId, parsedFeed.items, feed.title || parsedFeed.title, idToken, config);
                stats.newArticles += newArticleCount;
                stats.successfulFeeds++;
                // Update feed metadata
                await updateDocument(`users/${uid}/feeds/${feedId}`, {
                    lastFetchedAt: new Date(),
                    lastSuccessAt: new Date(),
                    errorCount: 0,
                    title: feed.title || parsedFeed.title,
                    description: feed.description || parsedFeed.description || '',
                }, idToken, config);
            }
            catch (error) {
                console.error(`Error refreshing feed ${feedId}:`, error);
                stats.failedFeeds++;
                await updateFeedError(uid, feedId, idToken, config);
            }
        }
        return new Response(JSON.stringify({
            message: 'Refresh complete',
            stats,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    catch (error) {
        console.error('Refresh error:', error);
        return new Response(JSON.stringify({ error: 'Failed to refresh feeds' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
/**
 * Parse RSS XML string
 * TODO: Implement proper XML parsing for Workers environment
 */
async function parseRssXml(xmlText) {
    // Simplified parsing for now
    // In production, use a proper XML parser compatible with Workers
    // For now, return a mock structure
    return {
        title: 'Feed Title',
        description: 'Feed Description',
        items: [],
    };
}
/**
 * Store articles in Firestore with TTL
 */
async function storeArticles(uid, feedId, articles, feedTitle, idToken, config) {
    if (articles.length === 0)
        return 0;
    let newArticleCount = 0;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    for (const article of articles) {
        // Generate article hash (feedId + guid)
        const articleHash = await generateArticleHash(feedId, article.guid);
        // Check if article already exists
        const existingArticle = await getDocument(`users/${uid}/articles/${articleHash}`, idToken, config);
        if (existingArticle) {
            continue; // Skip existing articles
        }
        // Add new article
        const success = await setDocument(`users/${uid}/articles/${articleHash}`, {
            feedId,
            feedTitle,
            title: article.title,
            url: article.link,
            description: article.content?.substring(0, 10000) || '', // Truncate to 10k chars
            publishedAt: article.publishedAt,
            fetchedAt: now,
            expiresAt,
            author: article.author || null,
        }, idToken, config);
        if (success) {
            newArticleCount++;
        }
    }
    return newArticleCount;
}
/**
 * Generate article hash from feedId and guid
 */
async function generateArticleHash(feedId, guid) {
    const input = `${feedId}:${guid}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 32);
}
/**
 * Update feed error count
 */
async function updateFeedError(uid, feedId, idToken, config) {
    const feed = await getDocument(`users/${uid}/feeds/${feedId}`, idToken, config);
    if (feed) {
        const errorCount = (feed.errorCount || 0) + 1;
        await updateDocument(`users/${uid}/feeds/${feedId}`, {
            lastFetchedAt: new Date(),
            errorCount,
        }, idToken, config);
    }
}
