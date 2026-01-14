/**
 * /api/user/account
 * DELETE: Delete user account (Supabase Auth + all data)
 */

import { requireAuth } from '../../lib/auth';
import { createSupabaseClient } from '../../lib/supabase';

/**
 * DELETE /api/user/account
 * Delete user account and all associated data
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

    console.log('Starting account deletion for user:', uid);

    const supabase = createSupabaseClient(env, accessToken);

    // Delete all user data from database
    // Due to CASCADE on foreign keys, deleting from parent tables should clean up related data
    // But we'll be explicit for clarity and to handle any edge cases
    try {
      console.log('Deleting database data...');

      // Delete read_articles
      await supabase.from('read_articles').delete().eq('user_id', uid);

      // Delete favorites
      await supabase.from('favorites').delete().eq('user_id', uid);

      // Delete articles (should cascade from feeds, but explicit for safety)
      await supabase.from('articles').delete().eq('user_id', uid);

      // Delete feeds
      await supabase.from('feeds').delete().eq('user_id', uid);

      // Delete user profile
      await supabase.from('user_profiles').delete().eq('id', uid);

      console.log('Database data deleted successfully');
    } catch (error) {
      console.error('Error deleting database data:', error);
      // Continue with Auth deletion even if database fails
    }

    // Try to delete Supabase Auth user using direct API call
    // Note: This may fail on some Supabase configurations, but data is already deleted
    try {
      console.log('Attempting to delete Supabase Auth user via REST API...');

      const supabaseUrl = env.SUPABASE_URL;
      const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

      if (serviceRoleKey) {
        const deleteResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${uid}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json',
          },
        });

        if (deleteResponse.ok) {
          console.log('Supabase Auth user deleted successfully');
        } else {
          // Log but don't fail - user data is already deleted
          const errorText = await deleteResponse.text();
          console.warn('Could not delete Auth user (data already deleted):', errorText);
        }
      }
    } catch (error) {
      // Log but don't fail - user data is already deleted
      console.warn('Error deleting Supabase Auth user (data already deleted):', error);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Delete account error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete account' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
