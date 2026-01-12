/**
 * POST /api/refresh
 * Refresh all feeds for authenticated user
 * Fetches RSS feeds via Workers, parses, and stores articles in Firestore
 */

import { requireAuth, getFirebaseConfig } from '../lib/auth';
import { listDocuments, updateDocument, setDocument, getDocument } from '../lib/firebase-rest';

interface RefreshStats {
  totalFeeds: number;
  successfulFeeds: number;
  failedFeeds: number;
  newArticles: number;
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
    const { uid, idToken } = authResult;

    const config = getFirebaseConfig(env);

    // Get all user's feeds
    const feeds = await listDocuments(
      `users/${uid}/feeds`,
      idToken,
      config,
      100
    );

    if (feeds.length === 0) {
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

    // Process each feed
    for (const feed of feeds) {
      const feedId = feed.id;
      const feedUrl = feed.url;

      console.log(`[Refresh] Processing feed ${feedId}: ${feed.title || feedUrl}`);

      try {
        // Fetch RSS XML via Worker
        const rssResponse = await fetch(`${workerUrl}/fetch?url=${encodeURIComponent(feedUrl)}`, {
          method: 'GET',
          headers: {
            'User-Agent': 'FeedOwn/1.0',
          },
        });

        if (!rssResponse.ok) {
          console.error(`Failed to fetch feed ${feedId}: ${rssResponse.status}`);
          stats.failedFeeds++;
          await updateFeedError(uid, feedId, idToken, config);
          continue;
        }

        const xmlText = await rssResponse.text();

        // Parse RSS XML
        const parsedFeed = await parseRssXml(xmlText);

        // Store articles in Firestore
        const newArticleCount = await storeArticles(
          uid,
          feedId,
          parsedFeed.items,
          feed.title || parsedFeed.title,
          idToken,
          config
        );

        console.log(`[Refresh] Feed ${feedId}: ${newArticleCount} new articles`);

        stats.newArticles += newArticleCount;
        stats.successfulFeeds++;

        // Extract favicon if not already set
        let faviconUrl = feed.faviconUrl || null;
        if (!faviconUrl) {
          faviconUrl = extractFaviconUrl(feedUrl);
        }

        // Update feed metadata
        await updateDocument(
          `users/${uid}/feeds/${feedId}`,
          {
            lastFetchedAt: new Date(),
            lastSuccessAt: new Date(),
            errorCount: 0,
            title: feed.title || parsedFeed.title,
            description: feed.description || parsedFeed.description || '',
            faviconUrl,
          },
          idToken,
          config
        );

      } catch (error) {
        console.error(`[Refresh] Error refreshing feed ${feedId}:`, error);
        stats.failedFeeds++;
        await updateFeedError(uid, feedId, idToken, config);
      }
    }

    console.log(`[Refresh] Complete: ${stats.successfulFeeds}/${stats.totalFeeds} feeds successful, ${stats.newArticles} new articles`);

    return new Response(
      JSON.stringify({
        message: 'Refresh complete',
        stats,
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
 * Simple regex-based parser for RSS 2.0 and Atom feeds
 */
async function parseRssXml(xmlText: string): Promise<any> {
  const result: any = {
    title: '',
    description: '',
    items: [],
  };

  // Check if it's an Atom feed
  const isAtom = xmlText.includes('<feed') && xmlText.includes('xmlns="http://www.w3.org/2005/Atom"');

  if (isAtom) {
    // Parse Atom feed
    const titleMatch = xmlText.match(/<title[^>]*>(.*?)<\/title>/);
    const subtitleMatch = xmlText.match(/<subtitle[^>]*>(.*?)<\/subtitle>/);

    result.title = titleMatch ? stripHtml(titleMatch[1]) : 'Untitled Feed';
    result.description = subtitleMatch ? stripHtml(subtitleMatch[1]) : '';

    // Extract entries
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

      // Extract image URL from Atom entry
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
  } else {
    // Parse RSS 2.0 feed
    const channelMatch = xmlText.match(/<channel[^>]*>([\s\S]*)<\/channel>/);
    if (!channelMatch) {
      throw new Error('Invalid RSS feed: no channel element found');
    }

    const channelXml = channelMatch[1];
    const titleMatch = channelXml.match(/<title[^>]*>(.*?)<\/title>/);
    const descMatch = channelXml.match(/<description[^>]*>(.*?)<\/description>/);

    result.title = titleMatch ? stripHtml(titleMatch[1]) : 'Untitled Feed';
    result.description = descMatch ? stripHtml(descMatch[1]) : '';

    // Extract items
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

      // Extract image URL from RSS item
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
 * Tries multiple common image sources in order of preference
 */
function extractImageUrl(entryXml: string, content: string): string | null {
  try {
    // 1. Try media:thumbnail (most common in RSS feeds)
    let match = entryXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
    if (match) {
      console.log('Found image via media:thumbnail:', match[1]);
      return match[1];
    }

    // 2. Try media:content with image type
    match = entryXml.match(/<media:content[^>]+type=["']image\/[^"']+"[^>]+url=["']([^"']+)["']/i);
    if (match) {
      console.log('Found image via media:content (1):', match[1]);
      return match[1];
    }
    match = entryXml.match(/<media:content[^>]+url=["']([^"']+)["'][^>]+type=["']image\/[^"']+["']/i);
    if (match) {
      console.log('Found image via media:content (2):', match[1]);
      return match[1];
    }

    // 3. Try enclosure with image type
    match = entryXml.match(/<enclosure[^>]+type=["']image\/[^"']+"[^>]+url=["']([^"']+)["']/i);
    if (match) {
      console.log('Found image via enclosure (1):', match[1]);
      return match[1];
    }
    match = entryXml.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image\/[^"']+["']/i);
    if (match) {
      console.log('Found image via enclosure (2):', match[1]);
      return match[1];
    }

    // 4. Try Atom link with rel="enclosure" and image type
    match = entryXml.match(/<link[^>]+rel=["']enclosure["'][^>]+type=["']image\/[^"']+"[^>]+href=["']([^"']+)["']/i);
    if (match) {
      console.log('Found image via atom link (1):', match[1]);
      return match[1];
    }
    match = entryXml.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']enclosure["'][^>]+type=["']image\/[^"']+["']/i);
    if (match) {
      console.log('Found image via atom link (2):', match[1]);
      return match[1];
    }

    // 5. Try to find first <img> tag in content (before stripping HTML)
    match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match) {
      console.log('Found image via img tag (1):', match[1]);
      return match[1];
    }

    // 6. Try img tag in entryXml as well
    match = entryXml.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match) {
      console.log('Found image via img tag (2):', match[1]);
      return match[1];
    }

    // 7. Try og:image meta tag in content
    match = content.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (match) {
      console.log('Found image via og:image:', match[1]);
      return match[1];
    }

    // 8. Try to find any URL ending with image extensions in description/content
    const imageUrlMatch = content.match(/https?:\/\/[^\s<>"]+\.(?:jpg|jpeg|png|gif|webp|bmp)(?:\?[^\s<>"]*)?/i);
    if (imageUrlMatch) {
      console.log('Found image via URL pattern:', imageUrlMatch[0]);
      return imageUrlMatch[0];
    }

    // 9. Try description tag with image URL
    match = entryXml.match(/<description[^>]*>[\s\S]*?(https?:\/\/[^\s<>"]+\.(?:jpg|jpeg|png|gif|webp|bmp)(?:\?[^\s<>"]*)?)/i);
    if (match) {
      console.log('Found image in description:', match[1]);
      return match[1];
    }

    // 10. Try content:encoded with image URL
    match = entryXml.match(/<content:encoded[^>]*>[\s\S]*?(https?:\/\/[^\s<>"]+\.(?:jpg|jpeg|png|gif|webp|bmp)(?:\?[^\s<>"]*)?)/i);
    if (match) {
      console.log('Found image in content:encoded:', match[1]);
      return match[1];
    }

    console.log('No image found for entry');
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
    // Use Google's favicon service
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch (error) {
    console.error('Error extracting favicon URL:', error);
    return '';
  }
}

/**
 * Store articles in Firestore with TTL
 */
async function storeArticles(
  uid: string,
  feedId: string,
  articles: any[],
  feedTitle: string,
  idToken: string,
  config: any
): Promise<number> {
  if (articles.length === 0) return 0;

  let newArticleCount = 0;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

  for (const article of articles) {
    // Generate article hash (feedId + guid)
    const articleHash = await generateArticleHash(feedId, article.guid);

    // Check if article already exists
    const existingArticle = await getDocument(
      `users/${uid}/articles/${articleHash}`,
      idToken,
      config
    );

    if (existingArticle) {
      continue; // Skip existing articles
    }

    // Add new article
    const success = await setDocument(
      `users/${uid}/articles/${articleHash}`,
      {
        feedId,
        feedTitle,
        title: article.title,
        url: article.link,
        description: article.content?.substring(0, 10000) || '', // Truncate to 10k chars
        publishedAt: article.publishedAt,
        fetchedAt: now,
        expiresAt,
        author: article.author || null,
        imageUrl: article.imageUrl || null,
      },
      idToken,
      config
    );

    if (success) {
      newArticleCount++;
    }
  }

  return newArticleCount;
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
  uid: string,
  feedId: string,
  idToken: string,
  config: any
): Promise<void> {
  const feed = await getDocument(
    `users/${uid}/feeds/${feedId}`,
    idToken,
    config
  );

  if (feed) {
    const errorCount = (feed.errorCount || 0) + 1;
    await updateDocument(
      `users/${uid}/feeds/${feedId}`,
      {
        lastFetchedAt: new Date(),
        errorCount,
      },
      idToken,
      config
    );
  }
}
