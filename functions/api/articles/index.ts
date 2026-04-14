/**
 * /api/articles
 * GET: List articles with smart refresh logic
 */

import { requireAuth } from '../../lib/auth';
import { createSupabaseClient } from '../../lib/supabase';

interface GetArticlesQuery {
  feedId?: string;
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

/**
 * GET /api/articles
 * Get articles for authenticated user
 * Implements smart refresh: triggers refresh if last fetch > 6 hours ago
 */
export async function onRequestGet(context: any): Promise<Response> {
  try {
    const { request, env } = context;

    // Require authentication
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { uid, accessToken } = authResult;

    // Parse query parameters
    const url = new URL(request.url);
    const feedId = url.searchParams.get('feedId');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';

    const supabase = createSupabaseClient(env, accessToken);

    // Fetch feeds to check refresh status and validate article feed IDs
    const { data: feeds, error: feedsError } = await supabase
      .from('feeds')
      .select('id, last_fetched_at')
      .eq('user_id', uid);

    if (feedsError) {
      console.error('Get feeds error:', feedsError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to get feeds' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const validFeedIds = new Set((feeds || []).map(feed => feed.id));
    const shouldRefresh = checkShouldRefreshFromFeeds(feeds || []);

    // Fetch all articles with pagination to avoid 1000-row limit
    const allArticles: any[] = [];
    {
      const PAGE_SIZE = 1000;
      let articleOffset = 0;
      while (true) {
        let articlesQuery = supabase
          .from('articles')
          .select(`
            id,
            feed_id,
            feed_title,
            title,
            url,
            description,
            published_at,
            fetched_at,
            expires_at,
            author,
            image_url
          `)
          .eq('user_id', uid)
          .gt('expires_at', new Date().toISOString())
          .order('published_at', { ascending: false, nullsFirst: false })
          .range(articleOffset, articleOffset + PAGE_SIZE - 1);

        if (feedId) {
          articlesQuery = articlesQuery.eq('feed_id', feedId);
        }

        const { data: page, error: articlesError } = await articlesQuery;

        if (articlesError) {
          console.error('Get articles error:', articlesError.message);
          return new Response(
            JSON.stringify({ error: 'Failed to get articles' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (!page || page.length === 0) break;
        allArticles.push(...page);
        if (page.length < PAGE_SIZE) break;
        articleOffset += PAGE_SIZE;
      }
    }

    // Filter articles from deleted feeds (in case of orphaned articles)
    let filteredArticles = allArticles.filter(article =>
      validFeedIds.has(article.feed_id)
    );

    // Get read article IDs for this user (paginated to avoid 1000-row limit)
    const readArticleIds = new Set<string>();
    {
      const PAGE_SIZE = 1000;
      let readOffset = 0;
      while (true) {
        const { data: readPage, error: readError } = await supabase
          .from('read_articles')
          .select('article_id')
          .eq('user_id', uid)
          .range(readOffset, readOffset + PAGE_SIZE - 1);

        if (readError) {
          console.error('Get read articles error:', readError.message);
          break;
        }
        if (!readPage || readPage.length === 0) break;
        for (const r of readPage) {
          readArticleIds.add(r.article_id);
        }
        if (readPage.length < PAGE_SIZE) break;
        readOffset += PAGE_SIZE;
      }
    }

    // Total count before pagination (for hasMore calculation)
    const totalCount = filteredArticles.length;

    // Apply pagination
    const paginatedArticles = filteredArticles.slice(offset, offset + limit);

    // Transform to API format with read status
    let articlesWithReadStatus = paginatedArticles.map(article => ({
      id: article.id,
      feedId: article.feed_id,
      feedTitle: article.feed_title,
      title: article.title,
      url: article.url,
      description: article.description,
      publishedAt: article.published_at,
      fetchedAt: article.fetched_at,
      expiresAt: article.expires_at,
      author: article.author,
      imageUrl: article.image_url,
      isRead: readArticleIds.has(article.id),
    }));

    // Filter by unread if specified
    if (unreadOnly) {
      articlesWithReadStatus = articlesWithReadStatus.filter(article => !article.isRead);
    }

    return new Response(
      JSON.stringify({
        articles: articlesWithReadStatus,
        shouldRefresh,
        hasMore: offset + limit < totalCount,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Get articles error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get articles' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Check if feeds should be refreshed based on feed data
 */
function checkShouldRefreshFromFeeds(feeds: { id: string; last_fetched_at: string | null }[]): boolean {
  try {
    if (feeds.length === 0) {
      return false;
    }

    const feedsWithFetchTime = feeds.filter(feed => feed.last_fetched_at);

    if (feedsWithFetchTime.length === 0) {
      return true; // Never fetched
    }

    // Get the most recent lastFetchedAt
    const mostRecentFetch = feedsWithFetchTime.reduce((latest, feed) => {
      const fetchTime = new Date(feed.last_fetched_at!).getTime();
      return fetchTime > latest ? fetchTime : latest;
    }, 0);

    if (mostRecentFetch === 0) {
      return true;
    }

    // Refresh if more than 6 hours ago
    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
    return mostRecentFetch < sixHoursAgo;
  } catch (error) {
    console.error('Check refresh error:', error);
    return false;
  }
}
