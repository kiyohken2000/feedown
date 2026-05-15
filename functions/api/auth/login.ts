/**
 * /api/auth/login
 *
 * Mobile login. Web app uses Supabase Client SDK directly.
 *
 * Routed through `onRequest` (not `onRequestPost`) so any HTTP method reaches
 * this Function and gets a JSON response. If we only export `onRequestPost`,
 * non-POST requests fall through to the Pages SPA fallback (index.html / 200)
 * and the mobile client sees a JSON parser failure. See lib/jsonResponse.ts.
 */

import { createSupabaseAnonClient } from '../../lib/supabase';
import { jsonResponse, methodNotAllowed, withJsonGuard } from '../../lib/jsonResponse';

interface LoginRequest {
  email?: string;
  password?: string;
  accessToken?: string;
}

async function handlePost(context: any): Promise<Response> {
  const { request, env } = context;

  let body: LoginRequest;
  try {
    body = await request.json();
  } catch (e: any) {
    return jsonResponse(
      { success: false, error: `Invalid JSON body: ${e?.message || 'parse error'}` },
      400
    );
  }

  const { email, password, accessToken } = body || {};
  const supabase = createSupabaseAnonClient(env);

  if (accessToken) {
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (error || !user) {
      return jsonResponse({ success: false, error: 'Invalid token' }, 401);
    }
    return jsonResponse({
      success: true,
      user: { uid: user.id, email: user.email },
      token: accessToken,
    });
  }

  if (!email || !password) {
    return jsonResponse(
      { success: false, error: 'Email/password or access token required' },
      400
    );
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('Login failed:', error.message);
    if (error.message.includes('Invalid login credentials')) {
      return jsonResponse({ success: false, error: 'Invalid email or password' }, 401);
    }
    return jsonResponse({ success: false, error: 'Login failed' }, 500);
  }

  return jsonResponse({
    success: true,
    user: { uid: data.user.id, email: data.user.email },
    token: data.session?.access_token,
    refreshToken: data.session?.refresh_token,
  });
}

export async function onRequest(context: any): Promise<Response> {
  const { request } = context;
  return withJsonGuard('auth/login', request, async () => {
    if (request.method !== 'POST') {
      return methodNotAllowed(request.method, ['POST']);
    }
    return handlePost(context);
  });
}
