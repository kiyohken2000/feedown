/**
 * /api/feeds
 * GET: List user's feeds
 * POST: Add new feed
 */

import { requireAuth, getFirebaseConfig } from '../../lib/auth';
import { listDocuments, createDocument } from '../../lib/firebase-rest';

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
      return authResult; // Return error response if not authenticated
    }
    const { uid, idToken } = authResult;

    const config = getFirebaseConfig(env);

    // Get user's feeds from Firestore
    const feeds = await listDocuments(
      `users/${uid}/feeds`,
      idToken,
      config,
      100
    );

    // Sort by order field (ascending), fallback to addedAt
    feeds.sort((a, b) => {
      const aOrder = a.order !== undefined ? a.order : (a.addedAt ? new Date(a.addedAt).getTime() : 0);
      const bOrder = b.order !== undefined ? b.order : (b.addedAt ? new Date(b.addedAt).getTime() : 0);
      return aOrder - bOrder;
    });

    return new Response(
      JSON.stringify({ feeds }),
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
    const { uid, idToken } = authResult;

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

    const config = getFirebaseConfig(env);

    // Get existing feeds to check limit and duplicates
    const existingFeeds = await listDocuments(
      `users/${uid}/feeds`,
      idToken,
      config,
      100
    );

    // Check feed limit (max 100 feeds per user)
    if (existingFeeds.length >= 100) {
      return new Response(
        JSON.stringify({ error: 'Maximum 100 feeds allowed' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if feed already exists
    const duplicateFeed = existingFeeds.find(feed => feed.url === url);
    if (duplicateFeed) {
      return new Response(
        JSON.stringify({ error: 'Feed already exists' }),
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
        // Continue without title
      }
    }

    // Extract favicon URL
    const faviconUrl = extractFaviconUrl(url);

    // Add feed to Firestore
    const feedData = {
      url,
      title: feedTitle,
      description: feedDescription,
      faviconUrl,
      addedAt: new Date(),
      lastFetchedAt: null,
      lastSuccessAt: null,
      errorCount: 0,
      order: Date.now(), // Use timestamp as default order
    };

    const result = await createDocument(
      `users/${uid}/feeds`,
      feedData,
      idToken,
      config
    );

    if (!result) {
      return new Response(
        JSON.stringify({ error: 'Failed to add feed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const newFeed = {
      id: result.id,
      ...feedData,
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
    // Check if it's an Atom feed
    const isAtom = xmlText.includes('<feed') && xmlText.includes('xmlns="http://www.w3.org/2005/Atom"');

    if (isAtom) {
      const titleMatch = xmlText.match(/<title[^>]*>(.*?)<\/title>/);
      const subtitleMatch = xmlText.match(/<subtitle[^>]*>(.*?)<\/subtitle>/);
      result.title = titleMatch ? stripHtmlTags(titleMatch[1]) : '';
      result.description = subtitleMatch ? stripHtmlTags(subtitleMatch[1]) : '';
    } else {
      // RSS 2.0
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

/**
 * Strip HTML tags and decode entities
 */
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

/**
 * Extract favicon URL from feed URL
 */
function extractFaviconUrl(feedUrl: string): string {
  try {
    const url = new URL(feedUrl);
    const domain = url.hostname;
    // Use Google's favicon service
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch (error) {
    console.error('Error extracting favicon URL:', error);
    return '';
  }
}
