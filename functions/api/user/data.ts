/**
 * /api/user/data
 * DELETE: Clear all user data (feeds, articles, favorites) but keep account
 */

import { requireAuth, getFirebaseConfig } from '../../lib/auth';
import { deleteCollection } from '../../lib/firebase-rest';

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
      // Delete feeds subcollection
      await deleteCollection(`users/${uid}/feeds`, idToken, config);

      // Delete articles subcollection
      await deleteCollection(`users/${uid}/articles`, idToken, config);

      // Delete readArticles subcollection
      await deleteCollection(`users/${uid}/readArticles`, idToken, config);

      // Delete favorites subcollection
      await deleteCollection(`users/${uid}/favorites`, idToken, config);

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
