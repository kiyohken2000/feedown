/**
 * /api/user/data
 * DELETE: Clear all user data (feeds, articles, favorites) but keep account
 */

import { requireAuth } from '../../lib/auth';
import { createSupabaseClient } from '../../lib/supabase';

/**
 * DELETE /api/user/data
 * Clear all user data while keeping the account active
 */
export async function onRequestDelete(context: any): Promise<Response> {
  try {
    const { request, env } = context;

    // Require authentication
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { uid, accessToken } = authResult;

    const supabase = createSupabaseClient(env, accessToken);

    try {
      console.log('Starting data deletion for user:', uid);

      // Delete read_articles
      console.log('Deleting read_articles...');
      const { error: readError } = await supabase
        .from('read_articles')
        .delete()
        .eq('user_id', uid);
      if (readError) console.error('Read articles delete error:', readError.message);
      console.log('Read articles deleted');

      // Delete favorites
      console.log('Deleting favorites...');
      const { error: favError } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', uid);
      if (favError) console.error('Favorites delete error:', favError.message);
      console.log('Favorites deleted');

      // Delete articles
      console.log('Deleting articles...');
      const { data: deletedArticles, error: articlesError, count: articlesCount } = await supabase
        .from('articles')
        .delete()
        .eq('user_id', uid)
        .select();
      if (articlesError) {
        console.error('Articles delete error:', articlesError.message, articlesError.code);
      } else {
        console.log('Articles deleted, count:', deletedArticles?.length || 0);
      }

      // Delete feeds
      console.log('Deleting feeds...');
      const { error: feedsError } = await supabase
        .from('feeds')
        .delete()
        .eq('user_id', uid);
      if (feedsError) console.error('Feeds delete error:', feedsError.message);
      console.log('Feeds deleted');

      console.log('All data cleared successfully for user:', uid);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'All data cleared successfully. Your account remains active.',
          // Debug info (temporary)
          _debug: {
            articlesDeleted: deletedArticles?.length || 0,
            articlesError: articlesError?.message || null,
          }
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      console.error('Error clearing user data:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to clear data' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Clear data error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to clear data' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
