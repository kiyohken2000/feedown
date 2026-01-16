/**
 * POST /api/refresh
 * Refresh all feeds for authenticated user
 * Fetches RSS feeds via Workers, parses, and stores articles in PostgreSQL
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

    // Get all user's feeds
    const { data: feeds, error: feedsError } = await supabase
      .from('feeds')
      .select('*')
      .eq('user_id', uid)
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

    const stats: RefreshStats = {
      totalFeeds: feeds.length,
      successfulFeeds: 0,
      failedFeeds: 0,
      newArticles: 0,
      failedFeedDetails: [],
    };

    console.log(`[Refresh] Starting refresh for ${feeds.length} feeds`);

    // Get Worker URL from environment
    const workerUrl = env.WORKER_URL || env.VITE_WORKER_URL;
    if (!workerUrl) {
      return new Response(
        JSON.stringify({ error: 'Worker URL not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get all existing article IDs once
    const { data: existingArticles, error: articlesError } = await supabase
      .from('articles')
      .select('id')
      .eq('user_id', uid);

    if (articlesError) {
      console.error('Get existing articles error:', articlesError.message);
    }

    const existingArticleIds = new Set((existingArticles || []).map(a => a.id));
    console.log(`[Refresh] Found ${existingArticleIds.size} existing articles`);

    // Process each feed sequentially
    for (const feed of feeds) {
      const feedId = feed.id;
      const feedUrl = feed.url;

      console.log(`[Refresh] Processing feed ${feedId}: ${feed.title || feedUrl}`);

      try {
        // Fetch RSS XML via Worker (bypass cache to get fresh data)
        const rssResponse = await fetch(`${workerUrl}/fetch?url=${encodeURIComponent(feedUrl)}&bypass_cache=1`, {
          method: 'GET',
          headers: {
            'User-Agent': 'FeedOwn/1.0',
          },
        });

        if (!rssResponse.ok) {
          const errorText = await rssResponse.text();
          const errorMsg = `HTTP ${rssResponse.status}: ${errorText.substring(0, 200)}`;
          console.error(`[Refresh] Failed to fetch feed ${feedId}`);
          stats.failedFeeds++;
          stats.failedFeedDetails?.push({
            feedId,
            feedTitle: feed.title || 'Unknown',
            feedUrl,
            error: errorMsg
          });
          await updateFeedError(supabase, feedId, uid);
          continue;
        }

        const xmlText = await rssResponse.text();

        // Parse RSS XML
        const parsedFeed = await parseRssXml(xmlText);
        console.log(`[Refresh] Feed ${feedId}: Parsed ${parsedFeed.items.length} items from RSS`);

        // Store articles in database
        const storeResult = await storeArticles(
          supabase,
          uid,
          feedId,
          parsedFeed.items,
          feed.title || parsedFeed.title,
          existingArticleIds
        );

        console.log(`[Refresh] Feed ${feedId}: ${storeResult.count} new articles`);

        stats.newArticles += storeResult.count;
        stats.successfulFeeds++;

        // Extract favicon if not already set
        let faviconUrl = feed.favicon_url || null;
        if (!faviconUrl) {
          faviconUrl = extractFaviconUrl(feedUrl);
        }

        // Update feed metadata
        const { error: updateError } = await supabase
          .from('feeds')
          .update({
            last_fetched_at: new Date().toISOString(),
            last_success_at: new Date().toISOString(),
            error_count: 0,
            title: feed.title || parsedFeed.title,
            description: feed.description || parsedFeed.description || '',
            favicon_url: faviconUrl,
          })
          .eq('id', feedId)
          .eq('user_id', uid);

        if (updateError) {
          console.error(`[Refresh] Failed to update feed ${feedId}:`, updateError.message);
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[Refresh] Error refreshing feed ${feedId}:`, error);
        stats.failedFeeds++;
        stats.failedFeedDetails?.push({
          feedId,
          feedTitle: feed.title || 'Unknown',
          feedUrl,
          error: errorMsg.substring(0, 200)
        });
        await updateFeedError(supabase, feedId, uid);
      }
    }

    console.log(`[Refresh] Complete: ${stats.successfulFeeds}/${stats.totalFeeds} feeds successful, ${stats.newArticles} new articles`);

    // Transform feeds to API format for response
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
        message: 'Refresh complete',
        stats,
        feeds: transformedFeeds,
        shouldRefreshArticles: stats.newArticles > 0,
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

/**
 * Parse RSS XML string
 */
async function parseRssXml(xmlText: string): Promise<any> {
  const result: any = {
    title: '',
    description: '',
    items: [],
  };

  const isAtom = xmlText.includes('<feed') && xmlText.includes('xmlns="http://www.w3.org/2005/Atom"');
  const isRdf = xmlText.includes('<rdf:RDF') || xmlText.includes('xmlns="http://purl.org/rss/1.0/"');

  if (isAtom) {
    const titleMatch = xmlText.match(/<title[^>]*>(.*?)<\/title>/);
    const subtitleMatch = xmlText.match(/<subtitle[^>]*>(.*?)<\/subtitle>/);

    result.title = titleMatch ? stripHtml(titleMatch[1]) : 'Untitled Feed';
    result.description = subtitleMatch ? stripHtml(subtitleMatch[1]) : '';

    const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/g;
    let entryMatch;

    while ((entryMatch = entryRegex.exec(xmlText)) !== null) {
      const entryXml = entryMatch[1];

      const entryTitle = entryXml.match(/<title[^>]*>(.*?)<\/title>/)?.[1] || 'Untitled';
      const entryLink = entryXml.match(/<link[^>]*href="([^"]+)"/)?.[1] || '';
      const entryId = entryXml.match(/<id[^>]*>(.*?)<\/id>/)?.[1] || entryLink;
      const entryContent = entryXml.match(/<content[^>]*>(.*?)<\/content>/s)?.[1] ||
                           entryXml.match(/<summary[^>]*>(.*?)<\/summary>/s)?.[1] || '';
      const entryPublished = entryXml.match(/<published[^>]*>(.*?)<\/published>/)?.[1] ||
                             entryXml.match(/<updated[^>]*>(.*?)<\/updated>/)?.[1] || new Date().toISOString();
      const entryAuthor = entryXml.match(/<author[^>]*>[\s\S]*?<name[^>]*>(.*?)<\/name>/)?.[1] || '';

      const imageUrl = extractImageUrl(entryXml, entryContent);

      result.items.push({
        title: stripHtml(entryTitle),
        link: entryLink,
        guid: entryId,
        content: stripHtml(entryContent),
        publishedAt: new Date(entryPublished),
        author: entryAuthor ? stripHtml(entryAuthor) : null,
        imageUrl,
      });
    }
  } else if (isRdf) {
    // RSS 1.0 (RDF) format - items are outside channel element
    console.log('[parseRssXml] Detected RDF/RSS 1.0 format');

    // Get channel metadata
    const channelMatch = xmlText.match(/<channel[^>]*>([\s\S]*?)<\/channel>/);
    if (channelMatch) {
      const channelXml = channelMatch[1];
      const titleMatch = channelXml.match(/<title[^>]*>(.*?)<\/title>/);
      const descMatch = channelXml.match(/<description[^>]*>(.*?)<\/description>/);
      result.title = titleMatch ? stripHtml(titleMatch[1]) : 'Untitled Feed';
      result.description = descMatch ? stripHtml(descMatch[1]) : '';
    }

    // Parse items from the entire XML (items are siblings of channel in RDF)
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
    let itemMatch;

    while ((itemMatch = itemRegex.exec(xmlText)) !== null) {
      const itemXml = itemMatch[1];

      const itemTitle = itemXml.match(/<title[^>]*>(.*?)<\/title>/)?.[1] || 'Untitled';
      const itemLink = itemXml.match(/<link[^>]*>(.*?)<\/link>/)?.[1] || '';
      // RDF uses rdf:about attribute as identifier, fallback to link
      const rdfAbout = itemMatch[0].match(/<item[^>]*rdf:about="([^"]+)"/)?.[1];
      const itemGuid = rdfAbout || itemLink;
      const itemDesc = itemXml.match(/<description[^>]*>(.*?)<\/description>/s)?.[1] || '';
      const itemContent = itemXml.match(/<content:encoded[^>]*>(.*?)<\/content:encoded>/s)?.[1] || itemDesc;
      // RDF uses dc:date instead of pubDate
      const itemPubDate = itemXml.match(/<dc:date[^>]*>(.*?)<\/dc:date>/)?.[1] ||
                          itemXml.match(/<pubDate[^>]*>(.*?)<\/pubDate>/)?.[1] || new Date().toISOString();
      const itemAuthor = itemXml.match(/<dc:creator[^>]*>(.*?)<\/dc:creator>/)?.[1] ||
                         itemXml.match(/<author[^>]*>(.*?)<\/author>/)?.[1] || '';

      const imageUrl = extractImageUrl(itemXml, itemContent);

      result.items.push({
        title: stripHtml(itemTitle),
        link: itemLink.trim(),
        guid: itemGuid.trim(),
        content: stripHtml(itemContent),
        publishedAt: new Date(itemPubDate),
        author: itemAuthor ? stripHtml(itemAuthor) : null,
        imageUrl,
      });
    }

    console.log(`[parseRssXml] RDF format: Found ${result.items.length} items`);
  } else {
    // RSS 2.0 format - items are inside channel element
    const channelMatch = xmlText.match(/<channel[^>]*>([\s\S]*)<\/channel>/);
    if (!channelMatch) {
      throw new Error('Invalid RSS feed: no channel element found');
    }

    const channelXml = channelMatch[1];
    const titleMatch = channelXml.match(/<title[^>]*>(.*?)<\/title>/);
    const descMatch = channelXml.match(/<description[^>]*>(.*?)<\/description>/);

    result.title = titleMatch ? stripHtml(titleMatch[1]) : 'Untitled Feed';
    result.description = descMatch ? stripHtml(descMatch[1]) : '';

    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
    let itemMatch;

    while ((itemMatch = itemRegex.exec(channelXml)) !== null) {
      const itemXml = itemMatch[1];

      const itemTitle = itemXml.match(/<title[^>]*>(.*?)<\/title>/)?.[1] || 'Untitled';
      const itemLink = itemXml.match(/<link[^>]*>(.*?)<\/link>/)?.[1] || '';
      const itemGuid = itemXml.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || itemLink;
      const itemDesc = itemXml.match(/<description[^>]*>(.*?)<\/description>/s)?.[1] || '';
      const itemContent = itemXml.match(/<content:encoded[^>]*>(.*?)<\/content:encoded>/s)?.[1] || itemDesc;
      const itemPubDate = itemXml.match(/<pubDate[^>]*>(.*?)<\/pubDate>/)?.[1] || new Date().toISOString();
      const itemAuthor = itemXml.match(/<(?:dc:)?creator[^>]*>(.*?)<\/(?:dc:)?creator>/)?.[1] ||
                         itemXml.match(/<author[^>]*>(.*?)<\/author>/)?.[1] || '';

      const imageUrl = extractImageUrl(itemXml, itemContent);

      result.items.push({
        title: stripHtml(itemTitle),
        link: itemLink.trim(),
        guid: itemGuid.trim(),
        content: stripHtml(itemContent),
        publishedAt: new Date(itemPubDate),
        author: itemAuthor ? stripHtml(itemAuthor) : null,
        imageUrl,
      });
    }
  }

  return result;
}

/**
 * Extract image URL from RSS/Atom entry
 */
function extractImageUrl(entryXml: string, content: string): string | null {
  try {
    // 1. Try media:thumbnail
    let match = entryXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
    if (match) return match[1];

    // 2. Try media:content with image type
    match = entryXml.match(/<media:content[^>]+type=["']image\/[^"']+"[^>]+url=["']([^"']+)["']/i);
    if (match) return match[1];
    match = entryXml.match(/<media:content[^>]+url=["']([^"']+)["'][^>]+type=["']image\/[^"']+["']/i);
    if (match) return match[1];

    // 3. Try enclosure with image type
    match = entryXml.match(/<enclosure[^>]+type=["']image\/[^"']+"[^>]+url=["']([^"']+)["']/i);
    if (match) return match[1];
    match = entryXml.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image\/[^"']+["']/i);
    if (match) return match[1];

    // 4. Try Atom link with rel="enclosure"
    match = entryXml.match(/<link[^>]+rel=["']enclosure["'][^>]+type=["']image\/[^"']+"[^>]+href=["']([^"']+)["']/i);
    if (match) return match[1];

    // 5. Try first <img> tag in content
    match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match) return match[1];

    // 6. Try img tag in entryXml
    match = entryXml.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match) return match[1];

    // 7. Try URL ending with image extensions
    const imageUrlMatch = content.match(/https?:\/\/[^\s<>"]+\.(?:jpg|jpeg|png|gif|webp|bmp)(?:\?[^\s<>"]*)?/i);
    if (imageUrlMatch) return imageUrlMatch[0];

    return null;
  } catch (error) {
    console.error('Error extracting image URL:', error);
    return null;
  }
}

/**
 * Strip HTML tags and decode HTML entities
 */
function stripHtml(html: string): string {
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
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch (error) {
    return '';
  }
}

interface StoreArticlesResult {
  count: number;
}

/**
 * Store articles in PostgreSQL
 */
async function storeArticles(
  supabase: any,
  uid: string,
  feedId: string,
  articles: any[],
  feedTitle: string,
  existingArticleIds: Set<string>
): Promise<StoreArticlesResult> {
  if (articles.length === 0) return { count: 0 };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days TTL

  // Collect new articles to insert
  const newArticles: any[] = [];

  for (const article of articles) {
    // Generate article hash (feedId + guid)
    const articleHash = await generateArticleHash(feedId, article.guid);

    // Check if article already exists
    if (existingArticleIds.has(articleHash)) {
      continue;
    }

    // Add to existing set to prevent duplicates within this batch
    existingArticleIds.add(articleHash);

    newArticles.push({
      id: articleHash,
      user_id: uid,
      feed_id: feedId,
      feed_title: feedTitle,
      title: article.title,
      url: article.link,
      description: article.content?.substring(0, 10000) || '',
      published_at: article.publishedAt?.toISOString() || null,
      fetched_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      author: article.author || null,
      image_url: article.imageUrl || null,
    });
  }

  if (newArticles.length === 0) {
    return { count: 0 };
  }

  console.log(`[storeArticles] Inserting ${newArticles.length} new articles for feed ${feedId}`);

  // Insert all articles in one batch
  const { error } = await supabase
    .from('articles')
    .insert(newArticles);

  if (error) {
    console.error(`[storeArticles] Insert error:`, error.message);
    return { count: 0 };
  }

  return { count: newArticles.length };
}

/**
 * Generate article hash from feedId and guid
 */
async function generateArticleHash(feedId: string, guid: string): Promise<string> {
  const input = `${feedId}:${guid}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 32);
}

/**
 * Update feed error count
 */
async function updateFeedError(
  supabase: any,
  feedId: string,
  uid: string
): Promise<void> {
  try {
    // Get current feed
    const { data: feed, error: fetchError } = await supabase
      .from('feeds')
      .select('error_count')
      .eq('id', feedId)
      .eq('user_id', uid)
      .single();

    if (fetchError || !feed) {
      return;
    }

    // Update with incremented error count
    await supabase
      .from('feeds')
      .update({
        last_fetched_at: new Date().toISOString(),
        error_count: (feed.error_count || 0) + 1,
      })
      .eq('id', feedId)
      .eq('user_id', uid);
  } catch (error) {
    console.error('Error updating feed error:', error);
  }
}
