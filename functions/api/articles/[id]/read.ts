/**
 * POST /api/articles/:id/read
 * Mark article as read
 * Note: This endpoint is kept for backward compatibility, but batch-read is preferred
 */

import { requireAuth } from '../../../lib/auth';
import { createSupabaseClient } from '../../../lib/supabase';

export async function onRequestPost(context: any): Promise<Response> {
  try {
    const { request, env, params } = context;

    // Require authentication
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { uid, accessToken } = authResult;

    const articleId = params.id;
    if (!articleId) {
      return new Response(
        JSON.stringify({ error: 'Article ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createSupabaseClient(env, accessToken);

    try {
      // Insert read record (upsert to handle duplicates)
      const { error } = await supabase
        .from('read_articles')
        .upsert({
          user_id: uid,
          article_id: articleId,
          read_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,article_id'
        });

      if (error) {
        console.error(`[read] Error marking article ${articleId} as read:`, error.message);
        // Return success anyway - read marks are not critical
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
