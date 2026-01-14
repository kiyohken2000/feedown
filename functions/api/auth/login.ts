/**
 * POST /api/auth/login
 * User login endpoint (for mobile app)
 *
 * Note: Web app uses Supabase Client SDK directly for authentication.
 * This endpoint is primarily for mobile apps that need server-side auth.
 */

import { createSupabaseAnonClient } from '../../lib/supabase';

interface LoginRequest {
  email?: string;
  password?: string;
  accessToken?: string; // Optional: if client already has Supabase access token
}

export async function onRequestPost(context: any): Promise<Response> {
  try {
    const { request, env } = context;

    // Parse request body
    const body: LoginRequest = await request.json();
    const { email, password, accessToken } = body;

    const supabase = createSupabaseAnonClient(env);

    // If client provides access token, verify it and return user info
    if (accessToken) {
      const { data: { user }, error } = await supabase.auth.getUser(accessToken);

      if (error || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            uid: user.id,
            email: user.email,
          },
          token: accessToken,
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
          error: 'Email/password or access token required',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Sign in with email and password using Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Login failed:', error.message);

      if (error.message.includes('Invalid login credentials')) {
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

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          uid: data.user.id,
          email: data.user.email,
        },
        token: data.session?.access_token,
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
