/**
 * /api/auth/register
 *
 * Mobile registration. Routed through `onRequest` so non-POST requests still
 * receive JSON instead of falling through to the Pages SPA fallback (HTML).
 * See lib/jsonResponse.ts.
 */

import { createSupabaseAnonClient, createSupabaseClient } from '../../lib/supabase';
import { isTestAccount } from '../../lib/auth';
import { jsonResponse, methodNotAllowed, withJsonGuard } from '../../lib/jsonResponse';

interface RegisterRequest {
  email?: string;
  password?: string;
}

async function handlePost(context: any): Promise<Response> {
  const { request, env } = context;

  let body: RegisterRequest;
  try {
    body = await request.json();
  } catch (e: any) {
    return jsonResponse(
      { success: false, error: `Invalid JSON body: ${e?.message || 'parse error'}` },
      400
    );
  }

  const { email, password } = body || {};

  if (!email || !password) {
    return jsonResponse(
      { success: false, error: 'Email and password are required' },
      400
    );
  }

  if (password.length < 6) {
    return jsonResponse(
      { success: false, error: 'Password must be at least 6 characters' },
      400
    );
  }

  const supabase = createSupabaseAnonClient(env);
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    console.error('Registration failed:', error.message);
    if (error.message.includes('already registered')) {
      return jsonResponse({ success: false, error: 'Email already registered' }, 400);
    }
    return jsonResponse(
      { success: false, error: 'Registration failed. ' + error.message },
      400
    );
  }

  if (!data.user || !data.session) {
    return jsonResponse(
      { success: false, error: 'Registration failed. Please try again.' },
      400
    );
  }

  const { user, session } = data;

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
  }

  return jsonResponse(
    {
      success: true,
      user: { uid: user.id, email: user.email },
      token: session.access_token,
      refreshToken: session.refresh_token,
    },
    201
  );
}

export async function onRequest(context: any): Promise<Response> {
  const { request } = context;
  return withJsonGuard('auth/register', request, async () => {
    if (request.method !== 'POST') {
      return methodNotAllowed(request.method, ['POST']);
    }
    return handlePost(context);
  });
}
