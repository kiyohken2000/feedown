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
export async function onRequestDelete(context) {
    try {
        const { request, env } = context;
        // Require authentication
        const authResult = await requireAuth(request, env);
        if (authResult instanceof Response) {
            return authResult;
        }
        const { uid, idToken } = authResult;
        const config = getFirebaseConfig(env);
        // Delete all user data from Firestore
        try {
            // Delete feeds subcollection
            await deleteCollection(`users/${uid}/feeds`, idToken, config);
            // Delete articles subcollection
            await deleteCollection(`users/${uid}/articles`, idToken, config);
            // Delete favorites subcollection
            await deleteCollection(`users/${uid}/favorites`, idToken, config);
            // Delete user document
            await deleteDocument(`users/${uid}`, idToken, config);
        }
        catch (error) {
            console.error('Error deleting Firestore data:', error);
            // Continue with Auth deletion even if Firestore fails
        }
        // Delete Firebase Auth user
        try {
            const deleteAuthUrl = `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${config.apiKey}`;
            const deleteAuthResponse = await fetch(deleteAuthUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    idToken: idToken,
                }),
            });
            if (!deleteAuthResponse.ok) {
                const error = await deleteAuthResponse.text();
                console.error('Failed to delete Firebase Auth user:', error);
                return new Response(JSON.stringify({ error: 'Failed to delete account' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
        }
        catch (error) {
            console.error('Error deleting Firebase Auth user:', error);
            return new Response(JSON.stringify({ error: 'Failed to delete account' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ success: true, message: 'Account deleted successfully' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    catch (error) {
        console.error('Delete account error:', error);
        return new Response(JSON.stringify({ error: 'Failed to delete account' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
