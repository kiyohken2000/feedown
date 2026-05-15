/**
 * /api/auth/refresh
 *
 * Routed through `onRequest` so non-POST requests still receive JSON instead
 * of falling through to the Pages SPA fallback (HTML). See lib/jsonResponse.ts.
 */

import { createSupabaseAnonClient } from '../../lib/supabase';
import { jsonResponse, methodNotAllowed, withJsonGuard } from '../../lib/jsonResponse';

interface RefreshRequest {
  refreshToken?: string;
}

async function handlePost(context: any): Promise<Response> {
  const { request, env } = context;

  let body: RefreshRequest;
  try {
    body = await request.json();
  } catch (e: any) {
    return jsonResponse(
      { success: false, error: `Invalid JSON body: ${e?.message || 'parse error'}` },
      400
    );
  }

  const { refreshToken } = body || {};

  if (!refreshToken) {
    return jsonResponse({ success: false, error: 'Refresh token is required' }, 400);
  }

  const supabase = createSupabaseAnonClient(env);
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    console.error('Token refresh failed:', error?.message);
    return jsonResponse(
      { success: false, error: 'Token refresh failed. Please login again.' },
      401
    );
  }

  return jsonResponse({
    success: true,
    user: { uid: data.user?.id, email: data.user?.email },
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
  });
}

export async function onRequest(context: any): Promise<Response> {
  const { request } = context;
  return withJsonGuard('auth/refresh', request, async () => {
    if (request.method !== 'POST') {
      return methodNotAllowed(request.method, ['POST']);
    }
    return handlePost(context);
  });
}
