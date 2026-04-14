/**
 * FeedOwn Worker - RSS Fetching Proxy + Queue Consumer for feed refresh
 */

import { createClient } from '@supabase/supabase-js';

export interface Env {
  CACHE: KVNamespace;
  FIREBASE_PROJECT_ID: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

interface FeedPayload {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  favicon_url: string | null;
  error_count: number;
}

interface RefreshMessage {
  userId: string;
  feed: FeedPayload;
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
async function fetchRss(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FeedOwn/1.0; +https://github.com/kiyohken2000/feedown)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// RSS parsing helpers (same logic as functions/api/refresh.ts)
// ---------------------------------------------------------------------------

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

function extractImageUrl(entryXml: string, content: string): string | null {
  let match = entryXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
  if (match) return match[1];
  match = entryXml.match(/<media:content[^>]+type=["']image\/[^"']+"[^>]+url=["']([^"']+)["']/i);
  if (match) return match[1];
  match = entryXml.match(/<media:content[^>]+url=["']([^"']+)["'][^>]+type=["']image\/[^"']+["']/i);
  if (match) return match[1];
  match = entryXml.match(/<enclosure[^>]+type=["']image\/[^"']+"[^>]+url=["']([^"']+)["']/i);
  if (match) return match[1];
  match = entryXml.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image\/[^"']+["']/i);
  if (match) return match[1];
  match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match) return match[1];
  match = entryXml.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match) return match[1];
  const urlMatch = content.match(/https?:\/\/[^\s<>"]+\.(?:jpg|jpeg|png|gif|webp|bmp)(?:\?[^\s<>"]*)?/i);
  if (urlMatch) return urlMatch[0];
  return null;
}

function extractFaviconUrl(feedUrl: string): string {
  try {
    const url = new URL(feedUrl);
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
  } catch {
    return '';
  }
}

interface ParsedFeed {
  title: string;
  description: string;
  items: ParsedItem[];
}

interface ParsedItem {
  title: string;
  link: string;
  guid: string;
  content: string;
  publishedAt: Date;
  author: string | null;
  imageUrl: string | null;
}

function parseRssXml(xmlText: string): ParsedFeed {
  const result: ParsedFeed = { title: '', description: '', items: [] };

  const isAtom = xmlText.includes('<feed') && xmlText.includes('xmlns="http://www.w3.org/2005/Atom"');
  const isRdf = xmlText.includes('<rdf:RDF') || xmlText.includes('xmlns="http://purl.org/rss/1.0/"');

  if (isAtom) {
    const titleMatch = xmlText.match(/<title[^>]*>(.*?)<\/title>/);
    const subtitleMatch = xmlText.match(/<subtitle[^>]*>(.*?)<\/subtitle>/);
    result.title = titleMatch ? stripHtml(titleMatch[1]) : 'Untitled Feed';
    result.description = subtitleMatch ? stripHtml(subtitleMatch[1]) : '';

    const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/g;
    let m;
    while ((m = entryRegex.exec(xmlText)) !== null) {
      const x = m[1];
      const title = x.match(/<title[^>]*>(.*?)<\/title>/)?.[1] || 'Untitled';
      const link = x.match(/<link[^>]*href="([^"]+)"/)?.[1] || '';
      const guid = x.match(/<id[^>]*>(.*?)<\/id>/)?.[1] || link;
      const content = x.match(/<content[^>]*>(.*?)<\/content>/s)?.[1] || x.match(/<summary[^>]*>(.*?)<\/summary>/s)?.[1] || '';
      const published = x.match(/<published[^>]*>(.*?)<\/published>/)?.[1] || x.match(/<updated[^>]*>(.*?)<\/updated>/)?.[1] || new Date().toISOString();
      const author = x.match(/<author[^>]*>[\s\S]*?<name[^>]*>(.*?)<\/name>/)?.[1] || '';
      result.items.push({ title: stripHtml(title), link, guid, content: stripHtml(content), publishedAt: new Date(published), author: author ? stripHtml(author) : null, imageUrl: extractImageUrl(x, content) });
    }
  } else if (isRdf) {
    const channelMatch = xmlText.match(/<channel[^>]*>([\s\S]*?)<\/channel>/);
    if (channelMatch) {
      result.title = stripHtml(channelMatch[1].match(/<title[^>]*>(.*?)<\/title>/)?.[1] || 'Untitled Feed');
      result.description = stripHtml(channelMatch[1].match(/<description[^>]*>(.*?)<\/description>/)?.[1] || '');
    }
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = itemRegex.exec(xmlText)) !== null) {
      const x = m[1];
      const title = x.match(/<title[^>]*>(.*?)<\/title>/)?.[1] || 'Untitled';
      const link = (x.match(/<link[^>]*>(.*?)<\/link>/)?.[1] || '').trim();
      const guid = (m[0].match(/<item[^>]*rdf:about="([^"]+)"/)?.[1] || link).trim();
      const desc = x.match(/<description[^>]*>(.*?)<\/description>/s)?.[1] || '';
      const content = x.match(/<content:encoded[^>]*>(.*?)<\/content:encoded>/s)?.[1] || desc;
      const published = x.match(/<dc:date[^>]*>(.*?)<\/dc:date>/)?.[1] || x.match(/<pubDate[^>]*>(.*?)<\/pubDate>/)?.[1] || new Date().toISOString();
      const author = x.match(/<dc:creator[^>]*>(.*?)<\/dc:creator>/)?.[1] || x.match(/<author[^>]*>(.*?)<\/author>/)?.[1] || '';
      result.items.push({ title: stripHtml(title), link, guid, content: stripHtml(content), publishedAt: new Date(published), author: author ? stripHtml(author) : null, imageUrl: extractImageUrl(x, content) });
    }
  } else {
    const channelMatch = xmlText.match(/<channel[^>]*>([\s\S]*)<\/channel>/);
    if (!channelMatch) throw new Error('Invalid RSS feed: no channel element found');
    const ch = channelMatch[1];
    result.title = stripHtml(ch.match(/<title[^>]*>(.*?)<\/title>/)?.[1] || 'Untitled Feed');
    result.description = stripHtml(ch.match(/<description[^>]*>(.*?)<\/description>/)?.[1] || '');
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = itemRegex.exec(ch)) !== null) {
      const x = m[1];
      const title = x.match(/<title[^>]*>(.*?)<\/title>/)?.[1] || 'Untitled';
      const link = (x.match(/<link[^>]*>(.*?)<\/link>/)?.[1] || '').trim();
      const guid = (x.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1] || link).trim();
      const desc = x.match(/<description[^>]*>(.*?)<\/description>/s)?.[1] || '';
      const content = x.match(/<content:encoded[^>]*>(.*?)<\/content:encoded>/s)?.[1] || desc;
      const published = x.match(/<pubDate[^>]*>(.*?)<\/pubDate>/)?.[1] || new Date().toISOString();
      const author = x.match(/<(?:dc:)?creator[^>]*>(.*?)<\/(?:dc:)?creator>/)?.[1] || x.match(/<author[^>]*>(.*?)<\/author>/)?.[1] || '';
      result.items.push({ title: stripHtml(title), link, guid, content: stripHtml(content), publishedAt: new Date(published), author: author ? stripHtml(author) : null, imageUrl: extractImageUrl(x, content) });
    }
  }

  return result;
}

async function generateArticleHash(feedId: string, guid: string): Promise<string> {
  const data = new TextEncoder().encode(`${feedId}:${guid}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

async function storeArticles(
  supabase: ReturnType<typeof createClient>,
  uid: string,
  feedId: string,
  items: ParsedItem[],
  feedTitle: string,
  existingIds: Set<string>
): Promise<number> {
  if (items.length === 0) return 0;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const newArticles: object[] = [];

  for (const item of items) {
    const id = await generateArticleHash(feedId, item.guid);
    if (existingIds.has(id)) continue;
    existingIds.add(id);
    newArticles.push({
      id,
      user_id: uid,
      feed_id: feedId,
      feed_title: feedTitle,
      title: item.title,
      url: item.link,
      description: item.content?.substring(0, 10000) || '',
      published_at: item.publishedAt?.toISOString() || null,
      fetched_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      author: item.author || null,
      image_url: item.imageUrl || null,
    });
  }

  if (newArticles.length === 0) return 0;

  const { error } = await supabase.from('articles').insert(newArticles);
  if (error) {
    console.error(`[Queue] Insert articles error for feed ${feedId}:`, error.message);
    return 0;
  }
  return newArticles.length;
}

// ---------------------------------------------------------------------------
// Worker export (fetch + queue handlers)
// ---------------------------------------------------------------------------

export default {
  // HTTP handler (RSS proxy with KV cache — unchanged)
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === '/fetch' && request.method === 'GET') {
      const rssUrl = url.searchParams.get('url');
      const bypassCache = url.searchParams.get('bypass_cache') === '1';

      if (!rssUrl) {
        return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!isValidUrl(rssUrl)) {
        return new Response(JSON.stringify({ error: 'Invalid URL' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const cacheKey = getCacheKey(rssUrl);

        if (!bypassCache) {
          const cached = await env.CACHE.get(cacheKey, { type: 'text' });
          if (cached) {
            return new Response(cached, {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/xml', 'X-Cache': 'HIT' },
            });
          }
        }

        const response = await fetchRss(rssUrl, FETCH_TIMEOUT);

        if (!response.ok) {
          return new Response(
            JSON.stringify({ error: `Failed to fetch RSS feed: ${response.status} ${response.statusText}` }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const xml = await response.text();

        if (!xml.trim().startsWith('<?xml') && !xml.trim().startsWith('<')) {
          return new Response(JSON.stringify({ error: 'Response is not valid XML' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        await env.CACHE.put(cacheKey, xml, { expirationTtl: CACHE_TTL });

        return new Response(xml, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/xml', 'X-Cache': 'MISS' },
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        if (msg.includes('aborted')) {
          return new Response(JSON.stringify({ error: 'Request timeout' }), {
            status: 504,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: `Network error: ${msg}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },

  // Queue consumer: process a batch of up to 10 feed refresh jobs
  async queue(batch: MessageBatch<RefreshMessage>, env: Env): Promise<void> {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Queue] Missing Supabase credentials');
      // Acknowledge all to avoid infinite retries on misconfiguration
      for (const msg of batch.messages) msg.ack();
      return;
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Group by userId so we can batch the article-ID pre-fetch
    const byUser = new Map<string, Array<{ feed: FeedPayload; msg: Message<RefreshMessage> }>>();
    for (const msg of batch.messages) {
      const { userId } = msg.body;
      if (!byUser.has(userId)) byUser.set(userId, []);
      byUser.get(userId)!.push({ feed: msg.body.feed, msg });
    }

    for (const [userId, items] of byUser) {
      const feedIds = items.map(i => i.feed.id);

      // Pre-fetch existing article IDs for ALL feeds in this batch — 1 subrequest
      const existingIds = new Set<string>();
      const { data: existing } = await supabase
        .from('articles')
        .select('id')
        .eq('user_id', userId)
        .in('feed_id', feedIds);
      for (const a of existing || []) existingIds.add(a.id);

      // Separate tracking: success upserts (full shape) vs error updates (partial)
      const successUpserts: object[] = [];
      const errorIds: { id: string; error_count: number }[] = [];
      const now = new Date().toISOString();

      for (const { feed, msg } of items) {
        try {
          const rssResponse = await fetchRss(feed.url, FETCH_TIMEOUT);

          if (!rssResponse.ok) {
            console.error(`[Queue] HTTP ${rssResponse.status} for ${feed.url}`);
            errorIds.push({ id: feed.id, error_count: (feed.error_count || 0) + 1 });
            msg.ack();
            continue;
          }

          const xml = await rssResponse.text();
          const parsed = parseRssXml(xml);
          const count = await storeArticles(supabase, userId, feed.id, parsed.items, feed.title || parsed.title, existingIds);

          console.log(`[Queue] Feed ${feed.id}: ${count} new articles`);
          successUpserts.push({
            id: feed.id,
            url: feed.url,
            user_id: userId,
            last_fetched_at: now,
            last_success_at: now,
            error_count: 0,
            title: feed.title || parsed.title,
            description: feed.description || parsed.description || '',
            favicon_url: feed.favicon_url || extractFaviconUrl(feed.url),
          });
          msg.ack();

        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error(`[Queue] Error for feed ${feed.id}:`, errMsg);
          errorIds.push({ id: feed.id, error_count: (feed.error_count || 0) + 1 });
          msg.ack();
        }
      }

      // Batch upsert successful feeds (full shape — 1 subrequest)
      if (successUpserts.length > 0) {
        const { error } = await supabase.from('feeds').upsert(successUpserts, { onConflict: 'id' });
        if (error) console.error('[Queue] Failed to upsert feeds:', error.message);
      }

      // Update only error_count + last_fetched_at for failed feeds (1 subrequest per feed, batched)
      for (const { id, error_count } of errorIds) {
        const { error } = await supabase
          .from('feeds')
          .update({ last_fetched_at: now, error_count })
          .eq('id', id)
          .eq('user_id', userId);
        if (error) console.error(`[Queue] Failed to update error feed ${id}:`, error.message);
      }
    }
  },
};
