/**
 * POST /api/refresh
 * Enqueue feed refresh jobs for the authenticated user.
 * Actual RSS fetching and article storage is handled asynchronously by
 * the feedown-worker Cloudflare Queue consumer (workers/src/index.ts).
 */

import { requireAuth } from '../lib/auth';
import { createSupabaseClient } from '../lib/supabase';

interface RefreshStats {
  totalFeeds: number;
  successfulFeeds: number;
  failedFeeds: number;
  newArticles: number;
  failedFeedDetails?: Array<{
    feedId: string;
    feedTitle: string;
    feedUrl: string;
    error: string;
  }>;
}

/**
 * POST /api/refresh
 * Trigger feed refresh for user
 */
export async function onRequestPost(context: any): Promise<Response> {
  try {
    const { request, env } = context;

    // Require authentication
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { uid, accessToken } = authResult;

    const supabase = createSupabaseClient(env, accessToken);

    // Get all user's feeds, prioritizing never-fetched feeds so newly added
    // feeds are not skipped when the function approaches its time limit
    const { data: feeds, error: feedsError } = await supabase
      .from('feeds')
      .select('*')
      .eq('user_id', uid)
      .order('last_fetched_at', { ascending: true, nullsFirst: true })
      .limit(100);

    if (feedsError) {
      console.error('Get feeds error:', feedsError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to get feeds' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!feeds || feeds.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No feeds to refresh',
          stats: {
            totalFeeds: 0,
            successfulFeeds: 0,
            failedFeeds: 0,
            newArticles: 0,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[Refresh] Enqueueing ${feeds.length} feeds for background processing`);

    // Enqueue all feeds as one batch — 1 subrequest regardless of feed count
    const messages = feeds.map(feed => ({
      body: {
        userId: uid,
        feed: {
          id: feed.id,
          url: feed.url,
          title: feed.title || null,
          description: feed.description || null,
          favicon_url: feed.favicon_url || null,
          error_count: feed.error_count || 0,
        },
      },
    }));

    await (env as any).REFRESH_QUEUE.sendBatch(messages);

    console.log(`[Refresh] Queued ${feeds.length} feeds`);

    // Transform feeds to API format for response (current metadata, pre-refresh)
    const transformedFeeds = feeds.map(feed => ({
      id: feed.id,
      url: feed.url,
      title: feed.title,
      description: feed.description,
      faviconUrl: feed.favicon_url,
      addedAt: feed.added_at,
      lastFetchedAt: feed.last_fetched_at,
      lastSuccessAt: feed.last_success_at,
      errorCount: feed.error_count,
      order: feed.order,
    }));

    return new Response(
      JSON.stringify({
        message: 'Refresh queued',
        stats: {
          totalFeeds: feeds.length,
          successfulFeeds: 0,
          failedFeeds: 0,
          newArticles: 0,
        },
        feeds: transformedFeeds,
        shouldRefreshArticles: false,
        queued: true,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Refresh error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to refresh feeds' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
