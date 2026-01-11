/**
 * /api/feeds
 * GET: List user's feeds
 * POST: Add new feed
 */
import { requireAuth } from '../../lib/auth';
import { getAdminFirestore } from '../../lib/firebase';
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
        const { uid } = authResult;
        const db = getAdminFirestore(env);
        // Get user's feeds from Firestore
        const feedsSnapshot = await db
            .collection('users')
            .doc(uid)
            .collection('feeds')
            .orderBy('addedAt', 'desc')
            .get();
        const feeds = feedsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));
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
        const { uid } = authResult;
        // Parse request body
        const body = await request.json();
        const { url, title, description } = body;
        // Validate input
        if (!url) {
            return new Response(JSON.stringify({ error: 'Feed URL is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const db = getAdminFirestore(env);
        // Check feed limit (max 100 feeds per user)
        const feedsSnapshot = await db
            .collection('users')
            .doc(uid)
            .collection('feeds')
            .count()
            .get();
        if (feedsSnapshot.data().count >= 100) {
            return new Response(JSON.stringify({ error: 'Maximum 100 feeds allowed' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        // Check if feed already exists
        const existingFeedSnapshot = await db
            .collection('users')
            .doc(uid)
            .collection('feeds')
            .where('url', '==', url)
            .limit(1)
            .get();
        if (!existingFeedSnapshot.empty) {
            return new Response(JSON.stringify({ error: 'Feed already exists' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        // Add feed to Firestore
        const feedRef = await db
            .collection('users')
            .doc(uid)
            .collection('feeds')
            .add({
            url,
            title: title || '',
            description: description || '',
            addedAt: new Date(),
            lastFetchedAt: null,
            lastSuccessAt: null,
            errorCount: 0,
        });
        const newFeed = {
            id: feedRef.id,
            url,
            title: title || '',
            description: description || '',
            addedAt: new Date(),
            lastFetchedAt: null,
            lastSuccessAt: null,
            errorCount: 0,
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
