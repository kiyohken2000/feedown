/**
 * Supabase Client for Cloudflare Workers/Functions
 * Creates Supabase clients for server-side usage
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

/**
 * Get Supabase configuration from environment
 */
export function getSupabaseConfig(env: any): SupabaseConfig {
  return {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

/**
 * Create Supabase client for authenticated user requests
 * Uses the user's access token for RLS enforcement
 */
export function createSupabaseClient(
  env: any,
  accessToken: string
): SupabaseClient {
  const config = getSupabaseConfig(env);

  return createClient(config.url, config.anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create Supabase admin client (bypasses RLS)
 * Use only for admin operations that need to bypass Row Level Security
 */
export function createSupabaseAdminClient(env: any): SupabaseClient {
  const config = getSupabaseConfig(env);

  if (!config.serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${config.serviceRoleKey}`,
      },
    },
  });
}

/**
 * Create anonymous Supabase client (for public operations like auth)
 */
export function createSupabaseAnonClient(env: any): SupabaseClient {
  const config = getSupabaseConfig(env);

  return createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
