/**
 * Cloudflare Pages Functions Middleware
 * Handles authentication and common response headers
 */
// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
export async function onRequest(context) {
    const { request } = context;
    // Handle OPTIONS (preflight)
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }
    // Add CORS headers to all responses
    const response = await context.next();
    Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });
    return response;
}
