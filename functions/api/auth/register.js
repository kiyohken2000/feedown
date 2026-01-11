/**
 * POST /api/auth/register
 * User registration endpoint (for mobile app)
 */
import { getAdminAuth, getAdminFirestore } from '../../lib/firebase';
export async function onRequestPost(context) {
    try {
        const { request, env } = context;
        // Parse request body
        const body = await request.json();
        const { email, password } = body;
        // Validate input
        if (!email || !password) {
            return new Response(JSON.stringify({ error: 'Email and password are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        if (password.length < 6) {
            return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const auth = getAdminAuth(env);
        const db = getAdminFirestore(env);
        // Create user in Firebase Auth
        const userRecord = await auth.createUser({
            email,
            password,
            emailVerified: false,
        });
        // Create user profile in Firestore
        await db.collection('users').doc(userRecord.uid).collection('profile').doc('data').set({
            email,
            createdAt: new Date(),
        });
        // Generate custom token for immediate login
        const customToken = await auth.createCustomToken(userRecord.uid);
        return new Response(JSON.stringify({
            success: true,
            user: {
                uid: userRecord.uid,
                email: userRecord.email,
            },
            token: customToken,
        }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        // Handle Firebase Auth errors
        if (error.code === 'auth/email-already-exists') {
            return new Response(JSON.stringify({ error: 'Email already exists' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ error: 'Registration failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
