/**
 * GET /api/favorites
 * Get user's favorite articles
 */

import { requireAuth } from '../lib/auth';
import { createSupabaseClient } from '../lib/supabase';

/**
 * GET /api/favorites
 * Get all favorite articles for authenticated user
 */
export async function onRequestGet(context: any): Promise<Response> {
  try {
    const { request, env } = context;

    // Require authentication
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { uid, accessToken } = authResult;

    const supabase = createSupabaseClient(env, accessToken);

    // Get all favorites
    const { data: favorites, error } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', uid)
      .order('saved_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('Get favorites error:', error.message);
      return new Response(
        JSON.stringify({ error: 'Failed to get favorites' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Transform to expected format (matching FeedsContext optimistic update format)
    const formattedFavorites = (favorites || []).map(fav => ({
      articleId: fav.id,
      title: fav.title,
      description: fav.description || '',
      url: fav.url,
      feedTitle: fav.feed_title || '',
      imageUrl: fav.image_url || null,
      createdAt: fav.saved_at,
    }));

    return new Response(
      JSON.stringify({
        favorites: formattedFavorites,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Get favorites error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get favorites' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/favorites
 * Add article to favorites
 */
export async function onRequestPost(context: any): Promise<Response> {
  try {
    const { request, env } = context;

    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) return authResult;
    const { uid, accessToken } = authResult;

    const body = await request.json();
    const { articleId, title, url, description, feedTitle, imageUrl } = body;

    if (!articleId || !url) {
      return new Response(
        JSON.stringify({ error: 'articleId and url are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createSupabaseClient(env, accessToken);

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
      });

    if (error) {
      console.error('Add favorite error:', error.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to add favorite' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Add favorite error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to add favorite' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function onRequestPost(context: any): Promise<Response> {
  try {
    const { request, env, params } = context;
    const articleId = params.id;
    
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) return authResult;
    const { uid, accessToken } = authResult;
    
    const body = await request.json();
    const { title, url, description, feedTitle, imageUrl } = body;
    
    const supabase = createSupabaseClient(env, accessToken);
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
      });
    
    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to add favorite' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to add favorite' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
