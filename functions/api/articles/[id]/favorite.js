/**
 * /api/articles/:id/favorite
 * POST: Add to favorites
 * DELETE: Remove from favorites
 */
import { requireAuth } from '../../../lib/auth';
import { getAdminFirestore } from '../../../lib/firebase';
/**
 * POST /api/articles/:id/favorite
 * Add article to favorites
 */
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
        // Get article data from request body
        const body = await request.json();
        const { title, url, description, feedTitle } = body;
        if (!title || !url) {
            return new Response(JSON.stringify({ error: 'Article title and URL are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const db = getAdminFirestore(env);
        // Add to favorites
        await db
            .collection('users')
            .doc(uid)
            .collection('favorites')
            .doc(articleId)
            .set({
            title,
            url,
            description: description || '',
            feedTitle: feedTitle || '',
            savedAt: new Date(),
        });
        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    catch (error) {
        console.error('Add favorite error:', error);
        return new Response(JSON.stringify({ error: 'Failed to add to favorites' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
/**
 * DELETE /api/articles/:id/favorite
 * Remove article from favorites
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
        const articleId = params.id;
        if (!articleId) {
            return new Response(JSON.stringify({ error: 'Article ID is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const db = getAdminFirestore(env);
        // Remove from favorites
        await db
            .collection('users')
            .doc(uid)
            .collection('favorites')
            .doc(articleId)
            .delete();
        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    catch (error) {
        console.error('Remove favorite error:', error);
        return new Response(JSON.stringify({ error: 'Failed to remove from favorites' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
