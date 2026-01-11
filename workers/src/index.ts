/**
 * FeedOwn Worker - RSS Fetching Proxy with CORS and KV Caching
 */

export interface Env {
  CACHE: KVNamespace;
  FIREBASE_PROJECT_ID: string;
}

const CACHE_TTL = 3600; // 1 hour in seconds
const FETCH_TIMEOUT = 10000; // 10 seconds

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Validate URL
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Generate cache key from URL
 */
function getCacheKey(url: string): string {
  return `rss:${url}`;
}

/**
 * Fetch RSS with timeout
 */
async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'FeedOwn/1.0 (RSS Reader)',
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle OPTIONS (preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // GET /fetch?url={rssUrl}
    if (url.pathname === '/fetch' && request.method === 'GET') {
      const rssUrl = url.searchParams.get('url');

      if (!rssUrl) {
        return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate URL
      if (!isValidUrl(rssUrl)) {
        return new Response(JSON.stringify({ error: 'Invalid URL' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const cacheKey = getCacheKey(rssUrl);

        // Check KV cache
        const cached = await env.CACHE.get(cacheKey, { type: 'text' });
        if (cached) {
          return new Response(cached, {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/xml',
              'X-Cache': 'HIT',
            },
          });
        }

        // Fetch RSS feed
        const response = await fetchWithTimeout(rssUrl, FETCH_TIMEOUT);

        if (!response.ok) {
          return new Response(
            JSON.stringify({
              error: `Failed to fetch RSS feed: ${response.status} ${response.statusText}`,
            }),
            {
              status: response.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const xml = await response.text();

        // Validate that response is XML
        if (!xml.trim().startsWith('<?xml') && !xml.trim().startsWith('<')) {
          return new Response(
            JSON.stringify({ error: 'Response is not valid XML' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Store in KV cache
        await env.CACHE.put(cacheKey, xml, {
          expirationTtl: CACHE_TTL,
        });

        return new Response(xml, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/xml',
            'X-Cache': 'MISS',
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Handle timeout
        if (errorMessage.includes('aborted')) {
          return new Response(
            JSON.stringify({ error: 'Request timeout' }),
            {
              status: 504,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Handle network errors
        return new Response(
          JSON.stringify({ error: `Network error: ${errorMessage}` }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
