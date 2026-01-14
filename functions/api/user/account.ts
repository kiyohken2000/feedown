/**
 * /api/user/account
 * DELETE: Delete user account (Firebase Auth + all Firestore data)
 */

import { requireAuth, getFirebaseConfig } from '../../lib/auth';
import { deleteDocument, deleteCollection } from '../../lib/firebase-rest';

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
    const { uid, idToken } = authResult;

    const config = getFirebaseConfig(env);
    console.log('Starting account deletion for user:', uid);
    console.log('Firebase Project ID:', config.projectId);

    // Delete all user data from Firestore
    try {
      console.log('Deleting Firestore data...');
      // Delete feeds subcollection
      await deleteCollection(`users/${uid}/feeds`, idToken, config);

      // Delete articles subcollection
      await deleteCollection(`users/${uid}/articles`, idToken, config);

      // Delete userState document (contains readArticleIds array)
      await deleteDocument(`users/${uid}/userState/main`, idToken, config);

      // Delete favorites subcollection
      await deleteCollection(`users/${uid}/favorites`, idToken, config);

      // Delete user document
      await deleteDocument(`users/${uid}`, idToken, config);
      console.log('Firestore data deleted successfully');
    } catch (error) {
      console.error('Error deleting Firestore data:', error);
      // Continue with Auth deletion even if Firestore fails
    }

    // Delete Firebase Auth user
    try {
      console.log('Deleting Firebase Auth user...');
      const deleteAuthUrl = `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${config.apiKey}`;
      console.log('Delete Auth URL:', deleteAuthUrl);

      const deleteAuthResponse = await fetch(deleteAuthUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken: idToken,
        }),
      });

      console.log('Delete Auth Response Status:', deleteAuthResponse.status);

      if (!deleteAuthResponse.ok) {
        const errorText = await deleteAuthResponse.text();
        console.error('Failed to delete Firebase Auth user. Status:', deleteAuthResponse.status);
        console.error('Error response:', errorText);

        let errorMessage = 'Failed to delete account';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorMessage;
        } catch (e) {
          // If parsing fails, use the text as is
          errorMessage = errorText || errorMessage;
        }

        return new Response(
          JSON.stringify({ error: errorMessage }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      console.log('Firebase Auth user deleted successfully');
    } catch (error) {
      console.error('Error deleting Firebase Auth user:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to delete account' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
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
