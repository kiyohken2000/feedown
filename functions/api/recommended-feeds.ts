/**
 * /api/recommended-feeds
 * GET: List recommended feeds (public, no auth required)
 */

import { createSupabaseAnonClient } from '../lib/supabase';

/**
 * GET /api/recommended-feeds
 * Get all active recommended feeds (public endpoint)
 */
export async function onRequestGet(context: any): Promise<Response> {
  try {
    const { env } = context;

    // Use anonymous client (no auth required for public data)
    const supabase = createSupabaseAnonClient(env);

    // Get active recommended feeds from database
    const { data: feeds, error } = await supabase
      .from('recommended_feeds')
      .select('id, name, url, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Get recommended feeds error:', error.message);
      return new Response(
        JSON.stringify({ error: 'Failed to get recommended feeds' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Transform to match expected format
    const transformedFeeds = (feeds || []).map(feed => ({
      name: feed.name,
      url: feed.url,
    }));

    return new Response(
      JSON.stringify({ feeds: transformedFeeds }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // Cache for 1 hour since recommended feeds don't change often
          'Cache-Control': 'public, max-age=3600',
        },
      }
    );
  } catch (error) {
    console.error('Get recommended feeds error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get recommended feeds' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
