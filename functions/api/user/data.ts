/**
 * /api/user/data
 * DELETE: Clear all user data (feeds, articles, favorites) but keep account
 */

import { requireAuth, getFirebaseConfig } from '../../lib/auth';
import { deleteCollection, deleteDocument } from '../../lib/firebase-rest';

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
    const { uid, idToken } = authResult;

    const config = getFirebaseConfig(env);

    try {
      console.log('Starting data deletion for user:', uid);

      // Delete feeds subcollection
      console.log('Deleting feeds...');
      await deleteCollection(`users/${uid}/feeds`, idToken, config);
      console.log('Feeds deleted');

      // Delete articles subcollection
      console.log('Deleting articles...');
      await deleteCollection(`users/${uid}/articles`, idToken, config);
      console.log('Articles deleted');

      // Delete userState document (contains readArticleIds array)
      console.log('Deleting userState...');
      await deleteDocument(`users/${uid}/userState/main`, idToken, config);
      console.log('UserState deleted');

      // Delete favorites subcollection
      console.log('Deleting favorites...');
      await deleteCollection(`users/${uid}/favorites`, idToken, config);
      console.log('Favorites deleted');

      console.log('All data cleared successfully for user:', uid);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'All data cleared successfully. Your account remains active.'
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
