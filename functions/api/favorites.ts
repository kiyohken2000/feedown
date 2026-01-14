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

    // Transform to expected format
    const formattedFavorites = (favorites || []).map(fav => ({
      articleId: fav.id,
      articleTitle: fav.title,
      articleDescription: fav.description || '',
      articleLink: fav.url,
      feedTitle: fav.feed_title || '',
      imageUrl: fav.image_url || null,
      savedAt: fav.saved_at,
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
