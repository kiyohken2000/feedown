/**
 * Authentication Middleware
 * Verifies Firebase ID tokens from Authorization header using REST API
 */
import { verifyIdToken } from './firebase-rest';
/**
 * Get Firebase config from environment
 */
export function getFirebaseConfig(env) {
    return {
        apiKey: env.FIREBASE_API_KEY,
        projectId: env.FIREBASE_PROJECT_ID,
        authDomain: env.FIREBASE_AUTH_DOMAIN,
    };
}
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
        const config = getFirebaseConfig(env);
        const user = await verifyIdToken(token, config);
        if (!user) {
            return null;
        }
        return {
            uid: user.uid,
            email: user.email,
            idToken: token,
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
/**
 * Check if user is a test account (created via Quick Create Test Account)
 * Test accounts have email format: test-{number}@test.com
 */
export function isTestAccount(email) {
    if (!email)
        return false;
    return /^test-\d+@test\.com$/i.test(email);
}
