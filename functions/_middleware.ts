/**
 * Cloudflare Pages Functions Middleware
 * Handles authentication and common response headers
 */

export interface Env {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Per-token / per-IP rate limit on POST /api/refresh — 1 req / 30 s at each edge colo.
// Added 2026-07-04 to stop a runaway client hammering feedown.pages.dev/api/refresh
// (feeds returned HTML instead of RSS, client retry loop kept re-sending offset=0
// and burned the account-wide Functions quota).
const REFRESH_LOCK_TTL_SECONDS = 30;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function refreshRateLimited(request: Request): Promise<Response | null> {
  const auth = request.headers.get('Authorization') || '';
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const bucket = auth || ip || 'anon';
  const keyHex = await sha256Hex(bucket);
  const cache = (caches as any).default as Cache;
  const cacheKey = new Request(`https://ratelimit.local/refresh/${keyHex}`);

  const hit = await cache.match(cacheKey);
  if (hit) {
    return new Response(
      JSON.stringify({
        error: 'Too many refresh requests. Please wait a moment before retrying.',
        retryAfterSec: REFRESH_LOCK_TTL_SECONDS,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(REFRESH_LOCK_TTL_SECONDS),
          ...corsHeaders,
        },
      }
    );
  }

  await cache.put(
    cacheKey,
    new Response('locked', {
      headers: { 'Cache-Control': `max-age=${REFRESH_LOCK_TTL_SECONDS}` },
    })
  );
  return null;
}

export async function onRequest(context: any): Promise<Response> {
  const { request } = context;

  // Handle OPTIONS (preflight)
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method === 'POST' && new URL(request.url).pathname === '/api/refresh') {
    const limited = await refreshRateLimited(request);
    if (limited) return limited;
  }

  // Add CORS headers to all responses
  const response = await context.next();
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}
