/**
 * /api/feeds/:id
 * DELETE: Remove feed
 * PATCH: Update feed (e.g., order)
 */

import { requireAuth } from '../../lib/auth';
import { createSupabaseClient } from '../../lib/supabase';

/**
 * DELETE /api/feeds/:id
 * Delete a feed
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

    const feedId = params.id;
    if (!feedId) {
      return new Response(
        JSON.stringify({ error: 'Feed ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createSupabaseClient(env, accessToken);

    // Check if feed exists
    const { data: feed, error: fetchError } = await supabase
      .from('feeds')
      .select('id')
      .eq('id', feedId)
      .eq('user_id', uid)
      .single();

    if (fetchError || !feed) {
      return new Response(
        JSON.stringify({ error: 'Feed not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Delete feed (CASCADE will delete associated articles)
    const { error } = await supabase
      .from('feeds')
      .delete()
      .eq('id', feedId)
      .eq('user_id', uid);

    if (error) {
      console.error('Delete feed error:', error.message);
      return new Response(
        JSON.stringify({ error: 'Failed to delete feed' }),
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
    console.error('Delete feed error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete feed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * PATCH /api/feeds/:id
 * Update a feed (e.g., order)
 */
export async function onRequestPatch(context: any): Promise<Response> {
  try {
    const { request, env, params } = context;

    // Require authentication
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { uid, accessToken } = authResult;

    const feedId = params.id;
    if (!feedId) {
      return new Response(
        JSON.stringify({ error: 'Feed ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createSupabaseClient(env, accessToken);

    // Check if feed exists
    const { data: feed, error: fetchError } = await supabase
      .from('feeds')
      .select('id')
      .eq('id', feedId)
      .eq('user_id', uid)
      .single();

    if (fetchError || !feed) {
      return new Response(
        JSON.stringify({ error: 'Feed not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await request.json();
    const { order } = body;

    if (order === undefined) {
      return new Response(
        JSON.stringify({ error: 'Order field is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update feed order
    const { error } = await supabase
      .from('feeds')
      .update({ order })
      .eq('id', feedId)
      .eq('user_id', uid);

    if (error) {
      console.error('Update feed error:', error.message);
      return new Response(
        JSON.stringify({ error: 'Failed to update feed' }),
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
    console.error('Update feed error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update feed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
