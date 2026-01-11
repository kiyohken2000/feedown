/**
 * Authentication Middleware
 * Verifies Firebase ID tokens from Authorization header
 */
import { getAdminAuth } from './firebase';
/**
 * Verify Firebase ID token from Authorization header
 * Returns user info if valid, null otherwise
 */
export async function verifyAuthToken(request, env) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        const token = authHeader.substring(7); // Remove "Bearer " prefix
        const auth = getAdminAuth(env);
        const decodedToken = await auth.verifyIdToken(token);
        return {
            uid: decodedToken.uid,
            email: decodedToken.email,
        };
    }
    catch (error) {
        console.error('Token verification failed:', error);
        return null;
    }
}
/**
 * Create error response for unauthorized requests
 */
export function unauthorizedResponse(message = 'Unauthorized') {
    return new Response(JSON.stringify({ error: message }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
    });
}
/**
 * Require authentication middleware
 * Use this in API handlers that require authentication
 */
export async function requireAuth(request, env) {
    const user = await verifyAuthToken(request, env);
    if (!user) {
        return unauthorizedResponse();
    }
    return user;
}
