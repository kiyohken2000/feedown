/**
 * POST /api/articles/:id/read
 * Mark article as read
 * Note: This endpoint is kept for backward compatibility, but batch-read is preferred
 */

import { requireAuth, getFirebaseConfig } from '../../../lib/auth';
import { getDocument, setDocument } from '../../../lib/firebase-rest';

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

    try {
      // Get current userState
      const userState = await getDocument(`users/${uid}/userState/main`, idToken, config);
      const currentIds: string[] = userState?.readArticleIds || [];

      // Check if already read
      if (!currentIds.includes(articleId)) {
        // Add article ID to array
        const newIds = [...currentIds, articleId];
        await setDocument(
          `users/${uid}/userState/main`,
          {
            readArticleIds: newIds,
            lastUpdated: new Date(),
          },
          idToken,
          config
        );
        // Don't check success - read marks are not critical
      }
    } catch (innerError) {
      console.error(`[read] Inner error for user ${uid}, article ${articleId}:`, innerError);
      // Return success anyway - read marks are not critical
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
    // Return success even on error - read marks are not critical
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
