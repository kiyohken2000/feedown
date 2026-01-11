/**
 * POST /api/auth/register
 * User registration endpoint (for mobile app)
 */

import { createUser, setDocument, type FirebaseConfig } from '../../lib/firebase-rest';
import { getFirebaseConfig } from '../../lib/auth';

interface RegisterRequest {
  email: string;
  password: string;
}

export async function onRequestPost(context: any): Promise<Response> {
  try {
    const { request, env } = context;

    // Parse request body
    const body: RegisterRequest = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const config = getFirebaseConfig(env);

    // Create user in Firebase Auth
    const result = await createUser(email, password, config);

    if (!result) {
      return new Response(
        JSON.stringify({ error: 'Registration failed. Email may already exist.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { uid, idToken } = result;

    // Create user profile in Firestore
    const profileCreated = await setDocument(
      `users/${uid}/profile/data`,
      {
        email,
        createdAt: new Date(),
      },
      idToken,
      config
    );

    if (!profileCreated) {
      console.error('Failed to create user profile');
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          uid,
          email,
        },
        token: idToken,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Registration error:', error);

    return new Response(
      JSON.stringify({ error: 'Registration failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
