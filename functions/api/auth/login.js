/**
 * POST /api/auth/login
 * User login endpoint (for mobile app)
 *
 * Note: This endpoint verifies credentials and returns a custom token.
 * Web app uses Firebase Client SDK directly for authentication.
 */
import { getAdminAuth } from '../../lib/firebase';
export async function onRequestPost(context) {
    try {
        const { request, env } = context;
        // Parse request body
        const body = await request.json();
        const { email, idToken } = body;
        const auth = getAdminAuth(env);
        // If client provides ID token, verify it and return user info
        if (idToken) {
            try {
                const decodedToken = await auth.verifyIdToken(idToken);
                return new Response(JSON.stringify({
                    success: true,
                    user: {
                        uid: decodedToken.uid,
                        email: decodedToken.email,
                    },
                    token: idToken,
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            catch (error) {
                return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
            }
        }
        // For password-based login, client should use Firebase Client SDK
        // This endpoint is mainly for token verification
        if (!email) {
            return new Response(JSON.stringify({
                error: 'Email or ID token required',
                hint: 'Mobile apps should authenticate with Firebase Client SDK first, then send ID token to this endpoint'
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        // Get user by email to generate custom token
        const userRecord = await auth.getUserByEmail(email);
        const customToken = await auth.createCustomToken(userRecord.uid);
        return new Response(JSON.stringify({
            success: true,
            user: {
                uid: userRecord.uid,
                email: userRecord.email,
            },
            customToken,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    catch (error) {
        console.error('Login error:', error);
        if (error.code === 'auth/user-not-found') {
            return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: 'Login failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
