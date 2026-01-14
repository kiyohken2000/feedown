/**
 * POST /api/auth/register
 * User registration endpoint (for mobile app)
 */

import { createSupabaseAnonClient, createSupabaseClient } from '../../lib/supabase';
import { isTestAccount } from '../../lib/auth';

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

    const supabase = createSupabaseAnonClient(env);

    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error('Registration failed:', error.message);

      if (error.message.includes('already registered')) {
        return new Response(
          JSON.stringify({ error: 'Email already registered' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Registration failed. ' + error.message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!data.user || !data.session) {
      return new Response(
        JSON.stringify({ error: 'Registration failed. Please try again.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { user, session } = data;

    // Create user profile in database
    const supabaseWithAuth = createSupabaseClient(env, session.access_token);

    const { error: profileError } = await supabaseWithAuth
      .from('user_profiles')
      .insert({
        id: user.id,
        email: user.email,
        is_test_account: isTestAccount(email),
        created_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error('Failed to create user profile:', profileError.message);
      // Don't fail registration if profile creation fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          uid: user.id,
          email: user.email,
        },
        token: session.access_token,
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
