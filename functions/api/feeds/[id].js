/**
 * /api/feeds/:id
 * DELETE: Remove feed
 */
import { requireAuth, getFirebaseConfig } from '../../lib/auth';
import { getDocument, deleteDocument } from '../../lib/firebase-rest';
/**
 * DELETE /api/feeds/:id
 * Delete a feed
 */
export async function onRequestDelete(context) {
    try {
        const { request, env, params } = context;
        // Require authentication
        const authResult = await requireAuth(request, env);
        if (authResult instanceof Response) {
            return authResult;
        }
        const { uid, idToken } = authResult;
        const feedId = params.id;
        if (!feedId) {
            return new Response(JSON.stringify({ error: 'Feed ID is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const config = getFirebaseConfig(env);
        // Check if feed exists
        const feedPath = `users/${uid}/feeds/${feedId}`;
        const feed = await getDocument(feedPath, idToken, config);
        if (!feed) {
            return new Response(JSON.stringify({ error: 'Feed not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }
        // Delete feed
        const deleted = await deleteDocument(feedPath, idToken, config);
        if (!deleted) {
            return new Response(JSON.stringify({ error: 'Failed to delete feed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
        // TODO: Also delete associated articles (optional, or handle with TTL)
        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    catch (error) {
        console.error('Delete feed error:', error);
        return new Response(JSON.stringify({ error: 'Failed to delete feed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
