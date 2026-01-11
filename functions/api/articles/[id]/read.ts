/**
 * POST /api/articles/:id/read
 * Mark article as read
 */

import { requireAuth, getFirebaseConfig } from '../../../lib/auth';
import { setDocument } from '../../../lib/firebase-rest';

export async function onRequestPost(context: any): Promise<Response> {
  try {
    const { request, env, params } = context;

    // Require authentication
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { uid, idToken } = authResult;

    const articleId = params.id;
    if (!articleId) {
      return new Response(
        JSON.stringify({ error: 'Article ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const config = getFirebaseConfig(env);

    // Mark article as read
    const success = await setDocument(
      `users/${uid}/readArticles/${articleId}`,
      {
        readAt: new Date(),
      },
      idToken,
      config
    );

    if (!success) {
      return new Response(
        JSON.stringify({ error: 'Failed to mark article as read' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Mark read error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to mark article as read' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
