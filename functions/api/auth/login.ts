/**
 * POST /api/auth/login
 * User login endpoint (for mobile app)
 *
 * Note: This endpoint verifies credentials and returns an ID token.
 * Web app uses Firebase Client SDK directly for authentication.
 */

import { verifyIdToken, type FirebaseConfig } from '../../lib/firebase-rest';
import { getFirebaseConfig } from '../../lib/auth';

interface LoginRequest {
  email?: string;
  password?: string;
  idToken?: string; // Optional: if client already has Firebase ID token
}

export async function onRequestPost(context: any): Promise<Response> {
  try {
    const { request, env } = context;

    // Parse request body
    const body: LoginRequest = await request.json();
    const { email, password, idToken } = body;

    const config = getFirebaseConfig(env);

    // If client provides ID token, verify it and return user info
    if (idToken) {
      const user = await verifyIdToken(idToken, config);

      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            uid: user.uid,
            email: user.email,
          },
          token: idToken,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // For email/password login
    if (!email || !password) {
      return new Response(
        JSON.stringify({
          error: 'Email/password or ID token required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Sign in with email and password using Firebase Auth REST API
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Login failed:', errorData);

      if (errorData.error?.message === 'EMAIL_NOT_FOUND' || errorData.error?.message === 'INVALID_PASSWORD') {
        return new Response(
          JSON.stringify({ error: 'Invalid email or password' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Login failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          uid: data.localId,
          email: data.email,
        },
        token: data.idToken,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Login error:', error);

    return new Response(
      JSON.stringify({ error: 'Login failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
