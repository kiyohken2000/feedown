/**
 * /api/feeds
 * GET: List feeds
 * POST: Add feed
 */

export async function onRequestGet(context: any): Promise<Response> {
  // TODO: Implement get feeds logic
  return new Response(JSON.stringify({ feeds: [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context: any): Promise<Response> {
  // TODO: Implement add feed logic
  return new Response(JSON.stringify({ message: 'Add feed endpoint' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
