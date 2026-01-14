/**
 * Authentication Middleware for Supabase
 * Verifies Supabase JWT tokens from Authorization header
 */

import { createSupabaseAnonClient } from './supabase';

export interface AuthenticatedRequest {
  uid: string;
  email: string | undefined;
  accessToken: string;
}

/**
 * Verify Supabase access token from Authorization header
 * Returns user info if valid, null otherwise
 */
export async function verifyAuthToken(
  request: Request,
  env: any
): Promise<AuthenticatedRequest | null> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Create Supabase client and verify the token
    const supabase = createSupabaseAnonClient(env);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('Token verification failed:', error?.message);
      return null;
    }

    return {
      uid: user.id,
      email: user.email,
      accessToken: token,
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Create error response for unauthorized requests
 */
export function unauthorizedResponse(message = 'Unauthorized'): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Require authentication middleware
 * Use this in API handlers that require authentication
 */
export async function requireAuth(
  request: Request,
  env: any
): Promise<AuthenticatedRequest | Response> {
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
export function isTestAccount(email: string | undefined): boolean {
  if (!email) return false;
  return /^test-\d+@test\.com$/i.test(email);
}
