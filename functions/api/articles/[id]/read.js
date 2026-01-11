/**
 * POST /api/articles/:id/read
 * Mark article as read
 */
import { requireAuth } from '../../../lib/auth';
import { getAdminFirestore } from '../../../lib/firebase';
export async function onRequestPost(context) {
    try {
        const { request, env, params } = context;
        // Require authentication
        const authResult = await requireAuth(request, env);
        if (authResult instanceof Response) {
            return authResult;
        }
        const { uid } = authResult;
        const articleId = params.id;
        if (!articleId) {
            return new Response(JSON.stringify({ error: 'Article ID is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const db = getAdminFirestore(env);
        // Mark article as read
        await db
            .collection('users')
            .doc(uid)
            .collection('readArticles')
            .doc(articleId)
            .set({
            readAt: new Date(),
        });
        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    catch (error) {
        console.error('Mark read error:', error);
        return new Response(JSON.stringify({ error: 'Failed to mark article as read' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
