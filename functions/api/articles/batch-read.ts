/**
 * POST /api/articles/batch-read
 * Mark multiple articles as read in a single request
 */

import { requireAuth } from '../../lib/auth';
import { createSupabaseClient } from '../../lib/supabase';

export async function onRequestPost(context: any): Promise<Response> {
  try {
    const { request, env } = context;

    // Require authentication
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { uid, accessToken } = authResult;

    // Parse request body
    const body = await request.json();
    const articleIds: string[] = body.articleIds;

    if (!articleIds || !Array.isArray(articleIds) || articleIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'articleIds array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createSupabaseClient(env, accessToken);

    // Get existing read articles to avoid duplicates
    const { data: existingReads, error: readError } = await supabase
      .from('read_articles')
      .select('article_id')
      .eq('user_id', uid)
      .in('article_id', articleIds);

    if (readError) {
      console.error('Get existing reads error:', readError.message);
    }

    const existingReadIds = new Set((existingReads || []).map(r => r.article_id));

    // Filter out already read articles
    const newArticleIds = articleIds.filter(id => !existingReadIds.has(id));

    if (newArticleIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, added: 0, total: existingReadIds.size }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Insert new read records
    const readRecords = newArticleIds.map(articleId => ({
      user_id: uid,
      article_id: articleId,
      read_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from('read_articles')
      .insert(readRecords);

    if (insertError) {
      console.error('Insert read articles error:', insertError.message);
      // Return success anyway - read marks are not critical
    }

    return new Response(
      JSON.stringify({
        success: true,
        added: newArticleIds.length,
        total: existingReadIds.size + newArticleIds.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Batch read error:', error);
    // Return success even on error (read marks are not critical)
    return new Response(
      JSON.stringify({ success: true, added: 0, total: 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
