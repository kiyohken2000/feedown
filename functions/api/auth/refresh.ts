/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */

import { createSupabaseAnonClient } from '../../lib/supabase';

interface RefreshRequest {
  refreshToken: string;
}

export async function onRequestPost(context: any): Promise<Response> {
  try {
    const { request, env } = context;

    // Parse request body
    const body: RefreshRequest = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return new Response(
        JSON.stringify({ error: 'Refresh token is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createSupabaseAnonClient(env);

    // Use refresh token to get new session
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      console.error('Token refresh failed:', error?.message);
      return new Response(
        JSON.stringify({ error: 'Token refresh failed. Please login again.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          uid: data.user?.id,
          email: data.user?.email,
        },
        token: data.session.access_token,
        refreshToken: data.session.refresh_token,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Token refresh error:', error);

    return new Response(
      JSON.stringify({ error: 'Token refresh failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
