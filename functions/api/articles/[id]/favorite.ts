/**
 * /api/articles/:id/favorite
 * POST: Add to favorites
 * DELETE: Remove from favorites
 */

import { requireAuth, isTestAccount } from '../../../lib/auth';
import { createSupabaseClient } from '../../../lib/supabase';

/**
 * POST /api/articles/:id/favorite
 * Add article to favorites
 */
export async function onRequestPost(context: any): Promise<Response> {
  try {
    const { request, env, params } = context;

    // Require authentication
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { uid, accessToken, email } = authResult;

    const articleId = params.id;
    if (!articleId) {
      return new Response(
        JSON.stringify({ error: 'Article ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get article data from request body
    const body = await request.json();
    const { title, url, description, feedTitle, imageUrl } = body;

    if (!title || !url) {
      return new Response(
        JSON.stringify({ error: 'Article title and URL are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createSupabaseClient(env, accessToken);

    // Check favorites limit for test accounts
    const isTest = isTestAccount(email);
    if (isTest) {
      const { count, error: countError } = await supabase
        .from('favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', uid);

      if (countError) {
        console.error('Count favorites error:', countError.message);
      }

      if ((count || 0) >= 10) {
        return new Response(
          JSON.stringify({
            error: 'Test accounts can only have up to 10 favorites. Please use a regular account for more favorites.'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Add to favorites
    const { error } = await supabase
      .from('favorites')
      .upsert({
        id: articleId,
        user_id: uid,
        title,
        url,
        description: description || '',
        feed_title: feedTitle || '',
        image_url: imageUrl || null,
        saved_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,id'
      });

    if (error) {
      console.error('Add favorite error:', error.message);
      return new Response(
        JSON.stringify({ error: 'Failed to add to favorites' }),
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
    console.error('Add favorite error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to add to favorites' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * DELETE /api/articles/:id/favorite
 * Remove article from favorites
 */
export async function onRequestDelete(context: any): Promise<Response> {
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

    // Remove from favorites
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('id', articleId)
      .eq('user_id', uid);

    if (error) {
      console.error('Remove favorite error:', error.message);
      return new Response(
        JSON.stringify({ error: 'Failed to remove from favorites' }),
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
    console.error('Remove favorite error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to remove from favorites' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
