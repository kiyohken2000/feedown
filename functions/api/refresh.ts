/**
 * POST /api/refresh
 * Refresh all feeds for authenticated user
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

export async function onRequestPost(context: any): Promise<Response> {
  try {
    const { request, env } = context;

    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) return authResult;
    const { uid, accessToken } = authResult;

    const supabase = createSupabaseClient(env, accessToken);

    const BATCH_SIZE = 5;
    const url = new URL(request.url);
    const batchOffset = parseInt(url.searchParams.get('offset') || '0', 10);

    const { data: allFeeds, error: feedsError } = await supabase
      .from('feeds')
      .select('*')
      .eq('user_id', uid)
      .order('last_fetched_at', { ascending: true, nullsFirst: true })
      .limit(100);

    const totalFeedCount = allFeeds?.length || 0;
    const feeds = allFeeds?.slice(batchOffset, batchOffset + BATCH_SIZE) || [];

    if (feedsError) return new Response(JSON.stringify({ error: 'Failed to get feeds' }), { status: 500 });

    if (!feeds || feeds.length === 0) {
      return new Response(JSON.stringify({
        message: 'No feeds to refresh',
        stats: { totalFeeds: totalFeedCount, successfulFeeds: 0, failedFeeds: 0, newArticles: 0 },
        remaining: 0,
      }), { status: 200 });
    }

    const remaining = Math.max(0, totalFeedCount - batchOffset - BATCH_SIZE);
    const stats: RefreshStats = { totalFeeds: totalFeedCount, successfulFeeds: 0, failedFeeds: 0, newArticles: 0, failedFeedDetails: [] };

    const existingArticleIds = new Set<string>();
    const PAGE_SIZE = 1000;
    let offset = 0;
    while (true) {
      const { data: page, error: pageError } = await supabase.from('articles').select('id').eq('user_id', uid).range(offset, offset + PAGE_SIZE - 1);
      if (pageError || !page || page.length === 0) break;
      for (const a of page) existingArticleIds.add(a.id);
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    for (const feed of feeds) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const rssResponse = await fetch(feed.url, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FeedOwn/1.0; +https://github.com/kiyohken2000/feedown)', 'Accept': '*/*' },
        });
        clearTimeout(timeoutId);

        if (!rssResponse.ok) {
          stats.failedFeeds++;
          await updateFeedError(supabase, feed.id, uid);
          continue;
        }

        const xmlText = await rssResponse.text();
        const parsedFeed = await parseRssXml(xmlText);

        const storeResult = await storeArticles(supabase, uid, feed.id, parsedFeed.items, feed.title || parsedFeed.title, existingArticleIds);

        stats.newArticles += storeResult.count;
        stats.successfulFeeds++;

        await supabase.from('feeds').update({
          last_fetched_at: new Date().toISOString(),
          last_success_at: new Date().toISOString(),
          error_count: 0,
          title: feed.title || parsedFeed.title,
          description: feed.description || parsedFeed.description || '',
          favicon_url: feed.favicon_url || extractFaviconUrl(feed.url),
        }).eq('id', feed.id).eq('user_id', uid);

      } catch (error) {
        stats.failedFeeds++;
        await updateFeedError(supabase, feed.id, uid);
      }
    }

    return new Response(JSON.stringify({
      message: remaining > 0 ? 'Batch complete' : 'Refresh complete',
      stats,
      shouldRefreshArticles: stats.newArticles > 0,
      remaining,
      nextOffset: remaining > 0 ? batchOffset + BATCH_SIZE : undefined,
    }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}

async function parseRssXml(xmlText: string): Promise<any> {
  const result: any = { title: '', description: '', items: [] };
  const isAtom = xmlText.includes('<feed') && xmlText.includes('xmlns="http://www.w3.org/2005/Atom"');
  const isRdf = xmlText.includes('<rdf:RDF') || xmlText.includes('xmlns="http://purl.org/rss/1.0/"');

  const itemRegex = isAtom ? /<entry[^>]*>([\s\S]*?)<\/entry>/g : /<item[^>]*>([\s\S]*?)<\/item>/g;
  let match;

  const titleMatch = xmlText.match(/<title[^>]*>(.*?)<\/title>/);
  result.title = titleMatch ? stripHtml(titleMatch[1]) : 'Untitled Feed';

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const xml = match[1];
    let link = '';
    if (isAtom) {
      link = cleanUrl(xml.match(/<link[^>]*href="([^"]+)"/)?.[1] || '');
    } else {
      link = cleanUrl(xml.match(/<link[^>]*>(.*?)<\/link>/)?.[1] || '');
    }

    const title = stripHtml(xml.match(/<title[^>]*>(.*?)<\/title>/)?.[1] || 'Untitled');
    const content = stripHtml(xml.match(/<(?:content:encoded|content|description|summary)[^>]*>([\s\S]*?)<\/(?:content:encoded|content|description|summary)>/)?.[1] || '');
    
    result.items.push({
      title,
      link, // ← ここを'link'に統一
      guid: xml.match(/<(?:guid|id)[^>]*>(.*?)<\/(?:guid|id)>/)?.[1] || link,
      content,
      publishedAt: new Date(),
      imageUrl: extractImageUrl(xml, content),
    });
  }
  return result;
}

function cleanUrl(url: string): string {
  if (!url) return '';
  let cleaned = stripHtml(url);
  try {
    const parsed = new URL(cleaned);
    if (parsed.hostname.includes('google') && parsed.pathname === '/url') {
      const actual = parsed.searchParams.get('url') || parsed.searchParams.get('q');
      if (actual) return actual;
    }
  } catch (e) {}
  return cleaned;
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/(?:&|&amp;)?\/?#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .trim();
}

function extractImageUrl(xml: string, content: string): string | null {
  let match = xml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i) || content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function extractFaviconUrl(feedUrl: string): string {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(feedUrl).hostname}&sz=32`; } catch { return ''; }
}

async function storeArticles(supabase: any, uid: string, feedId: string, articles: any[], feedTitle: string, existingArticleIds: Set<string>): Promise<any> {
  const newArticles = [];
  const now = new Date();
  for (const article of articles) {
    const articleHash = await generateArticleHash(feedId, article.guid);
    if (existingArticleIds.has(articleHash)) continue;
    
    // ↓ ここが修正ポイント！article.urlじゃなくてarticle.linkを使う
    if (!article.link) continue; 

    newArticles.push({
      id: articleHash, user_id: uid, feed_id: feedId, feed_title: feedTitle,
      title: article.title, url: article.link, 
      description: article.content?.substring(0, 10000),
      published_at: now.toISOString(), fetched_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      image_url: article.imageUrl,
    });
  }
  if (newArticles.length > 0) {
    await supabase.from('articles').upsert(newArticles, { onConflict: 'id', ignoreDuplicates: true });
  }
  return { count: newArticles.length };
}

async function generateArticleHash(feedId: string, guid: string): Promise<string> {
  const data = new TextEncoder().encode(`${feedId}:${guid}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

async function updateFeedError(supabase: any, feedId: string, uid: string): Promise<void> {
  const { data: feed } = await supabase.from('feeds').select('error_count').eq('id', feedId).single();
  if (feed) await supabase.from('feeds').update({ error_count: (feed.error_count || 0) + 1 }).eq('id', feedId);
}
