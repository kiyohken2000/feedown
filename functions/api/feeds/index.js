/**
 * /api/feeds
 * GET: List user's feeds
 * POST: Add new feed
 */
import { requireAuth, getFirebaseConfig } from '../../lib/auth';
import { listDocuments, createDocument } from '../../lib/firebase-rest';
/**
 * GET /api/feeds
 * Get all feeds for authenticated user
 */
export async function onRequestGet(context) {
    try {
        const { request, env } = context;
        // Require authentication
        const authResult = await requireAuth(request, env);
        if (authResult instanceof Response) {
            return authResult; // Return error response if not authenticated
        }
        const { uid, idToken } = authResult;
        const config = getFirebaseConfig(env);
        // Get user's feeds from Firestore
        const feeds = await listDocuments(`users/${uid}/feeds`, idToken, config, 100);
        // Sort by addedAt descending
        feeds.sort((a, b) => {
            const aTime = a.addedAt ? new Date(a.addedAt).getTime() : 0;
            const bTime = b.addedAt ? new Date(b.addedAt).getTime() : 0;
            return bTime - aTime;
        });
        return new Response(JSON.stringify({ feeds }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    catch (error) {
        console.error('Get feeds error:', error);
        return new Response(JSON.stringify({ error: 'Failed to get feeds' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
/**
 * POST /api/feeds
 * Add new feed
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
        // Parse request body
        const body = await request.json();
        const { url, title, description } = body;
        // Validate input
        if (!url) {
            return new Response(JSON.stringify({ error: 'Feed URL is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const config = getFirebaseConfig(env);
        // Get existing feeds to check limit and duplicates
        const existingFeeds = await listDocuments(`users/${uid}/feeds`, idToken, config, 100);
        // Check feed limit (max 100 feeds per user)
        if (existingFeeds.length >= 100) {
            return new Response(JSON.stringify({ error: 'Maximum 100 feeds allowed' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        // Check if feed already exists
        const duplicateFeed = existingFeeds.find(feed => feed.url === url);
        if (duplicateFeed) {
            return new Response(JSON.stringify({ error: 'Feed already exists' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        // Add feed to Firestore
        const feedData = {
            url,
            title: title || '',
            description: description || '',
            addedAt: new Date(),
            lastFetchedAt: null,
            lastSuccessAt: null,
            errorCount: 0,
        };
        const result = await createDocument(`users/${uid}/feeds`, feedData, idToken, config);
        if (!result) {
            return new Response(JSON.stringify({ error: 'Failed to add feed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
        const newFeed = {
            id: result.id,
            ...feedData,
        };
        return new Response(JSON.stringify({ feed: newFeed }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    catch (error) {
        console.error('Add feed error:', error);
        return new Response(JSON.stringify({ error: 'Failed to add feed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
