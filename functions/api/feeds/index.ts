/**
 * /api/feeds
 * GET: List user's feeds
 * POST: Add new feed
 */

import { requireAuth, isTestAccount } from '../../lib/auth';
import { createSupabaseClient } from '../../lib/supabase';

/**
 * GET /api/feeds
 * Get all feeds for authenticated user
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

    const supabase = createSupabaseClient(env, accessToken);

    // Get user's feeds from database
    const { data: feeds, error } = await supabase
      .from('feeds')
      .select('*')
      .eq('user_id', uid)
      .order('order', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Get feeds error:', error.message);
      return new Response(
        JSON.stringify({ error: 'Failed to get feeds' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Transform to match expected format
    const transformedFeeds = (feeds || []).map(feed => ({
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
      JSON.stringify({ feeds: transformedFeeds }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Get feeds error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get feeds' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/feeds
 * Add new feed
 */
export async function onRequestPost(context: any): Promise<Response> {
  try {
    const { request, env } = context;

    // Require authentication
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { uid, accessToken, email } = authResult;

    // Parse request body
    const body = await request.json();
    const { url, title, description } = body;

    // Validate input
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'Feed URL is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createSupabaseClient(env, accessToken);

    // Check feed count limit
    const { count, error: countError } = await supabase
      .from('feeds')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid);

    if (countError) {
      console.error('Count feeds error:', countError.message);
    }

    const isTest = isTestAccount(email);
    const maxFeeds = isTest ? 3 : 100;

    if ((count || 0) >= maxFeeds) {
      return new Response(
        JSON.stringify({
          error: isTest
            ? 'Test accounts can only have up to 3 feeds. Please use a regular account for more feeds.'
            : 'Maximum 100 feeds allowed'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Try to fetch feed title from RSS
    let feedTitle = title || '';
    let feedDescription = description || '';

    if (!feedTitle) {
      try {
        const workerUrl = env.WORKER_URL || env.VITE_WORKER_URL;
        if (workerUrl) {
          const rssResponse = await fetch(`${workerUrl}/fetch?url=${encodeURIComponent(url)}`, {
            method: 'GET',
            headers: {
              'User-Agent': 'FeedOwn/1.0',
            },
          });

          if (rssResponse.ok) {
            const xmlText = await rssResponse.text();
            const parsedFeed = await parseFeedBasicInfo(xmlText);
            feedTitle = parsedFeed.title || '';
            feedDescription = parsedFeed.description || '';
          }
        }
      } catch (error) {
        console.error('Failed to fetch feed title:', error);
      }
    }

    // Extract favicon URL
    const faviconUrl = extractFaviconUrl(url);

    // Add feed to database
    const { data: feed, error } = await supabase
      .from('feeds')
      .insert({
        user_id: uid,
        url,
        title: feedTitle,
        description: feedDescription,
        favicon_url: faviconUrl,
        added_at: new Date().toISOString(),
        last_fetched_at: null,
        last_success_at: null,
        error_count: 0,
        order: Date.now(),
      })
      .select()
      .single();

    if (error) {
      console.error('Add feed error:', error.message);

      if (error.code === '23505') { // Unique violation
        return new Response(
          JSON.stringify({ error: 'Feed already exists' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to add feed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Transform to match expected format
    const newFeed = {
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
    };

    return new Response(
      JSON.stringify({ feed: newFeed }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Add feed error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to add feed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Parse RSS XML to get basic feed info (title, description)
 */
async function parseFeedBasicInfo(xmlText: string): Promise<{ title: string; description: string }> {
  const result = {
    title: '',
    description: '',
  };

  try {
    const isAtom = xmlText.includes('<feed') && xmlText.includes('xmlns="http://www.w3.org/2005/Atom"');

    if (isAtom) {
      const titleMatch = xmlText.match(/<title[^>]*>(.*?)<\/title>/);
      const subtitleMatch = xmlText.match(/<subtitle[^>]*>(.*?)<\/subtitle>/);
      result.title = titleMatch ? stripHtmlTags(titleMatch[1]) : '';
      result.description = subtitleMatch ? stripHtmlTags(subtitleMatch[1]) : '';
    } else {
      const channelMatch = xmlText.match(/<channel[^>]*>([\s\S]*?)<\/channel>/);
      if (channelMatch) {
        const channelXml = channelMatch[1];
        const titleMatch = channelXml.match(/<title[^>]*>(.*?)<\/title>/);
        const descMatch = channelXml.match(/<description[^>]*>(.*?)<\/description>/);
        result.title = titleMatch ? stripHtmlTags(titleMatch[1]) : '';
        result.description = descMatch ? stripHtmlTags(descMatch[1]) : '';
      }
    }
  } catch (error) {
    console.error('Error parsing feed basic info:', error);
  }

  return result;
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function extractFaviconUrl(feedUrl: string): string {
  try {
    const url = new URL(feedUrl);
    const domain = url.hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch (error) {
    console.error('Error extracting favicon URL:', error);
    return '';
  }
}
