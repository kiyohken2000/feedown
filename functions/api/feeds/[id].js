/**
 * /api/feeds/:id
 * DELETE: Remove feed
 */
import { requireAuth } from '../../lib/auth';
import { getAdminFirestore } from '../../lib/firebase';
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
        const { uid } = authResult;
        const feedId = params.id;
        if (!feedId) {
            return new Response(JSON.stringify({ error: 'Feed ID is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const db = getAdminFirestore(env);
        // Check if feed exists
        const feedRef = db
            .collection('users')
            .doc(uid)
            .collection('feeds')
            .doc(feedId);
        const feedDoc = await feedRef.get();
        if (!feedDoc.exists) {
            return new Response(JSON.stringify({ error: 'Feed not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }
        // Delete feed
        await feedRef.delete();
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
