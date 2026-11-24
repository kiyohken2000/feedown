/**
 * Feed fetching, validation and discovery for POST /api/feeds.
 * Kept out of the route file so the pure helpers can be unit-tested.
 */

import { parseHTML } from 'linkedom';

const FETCH_TIMEOUT_MS = 10000;
const USER_AGENT = 'FeedOwn/1.0 (RSS Reader)';
const FEED_TYPES = new Set(['application/rss+xml', 'application/atom+xml']);

export type FeedFetchResult =
  | { ok: true; xmlText: string }
  | { ok: false; error: string; body?: string };

/**
 * Fetch a URL and check that it is an RSS/Atom feed with at least one item.
 * When the response is not a feed, `body` carries the text so the caller can
 * look for a feed link in it.
 */
export async function fetchAndValidateFeed(url: string): Promise<FeedFetchResult> {
  let text: string;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return { ok: false, error: `Feed URL returned HTTP ${response.status}` };
    }
    text = await response.text();
  } catch (error) {
    console.error('Failed to fetch feed:', error);
    return { ok: false, error: 'Could not reach feed URL' };
  }

  if (!looksLikeFeed(text)) {
    return { ok: false, error: 'URL does not appear to be an RSS or Atom feed', body: text };
  }
  if (!hasFeedItems(text)) {
    return { ok: false, error: 'Feed contains no articles' };
  }
  return { ok: true, xmlText: text };
}

/**
 * Find the first RSS/Atom feed advertised by an HTML page through
 * <link rel="alternate" type="application/rss+xml|atom+xml" href="...">.
 * Relative hrefs are resolved against pageUrl. Returns null when none is found.
 */
export function discoverFeedUrl(html: string, pageUrl: string): string | null {
  if (!html) return null;
  let links: any[];
  try {
    const { document } = parseHTML(html);
    links = Array.from(document.querySelectorAll('link[href]'));
  } catch (error) {
    console.error('Failed to parse HTML for feed discovery:', error);
    return null;
  }

  for (const link of links) {
    const rel = (link.getAttribute('rel') || '').toLowerCase().split(/\s+/);
    if (!rel.includes('alternate')) continue;
    const type = (link.getAttribute('type') || '').toLowerCase().split(';')[0].trim();
    if (!FEED_TYPES.has(type)) continue;
    const href = (link.getAttribute('href') || '').trim();
    if (!href) continue;
    try {
      const resolved = new URL(href, pageUrl);
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue;
      return resolved.toString();
    } catch {
      continue;
    }
  }
  return null;
}

export function looksLikeFeed(xmlText: string): boolean {
  const head = xmlText.replace(/^﻿/, '').trimStart().slice(0, 2000);
  if (/^<!DOCTYPE\s+html/i.test(head) || /^<html[\s>]/i.test(head)) return false;
  if (/<rss[\s>]/i.test(head)) return true;
  if (/<feed[\s>]/i.test(head) && head.includes('http://www.w3.org/2005/Atom')) return true;
  if (/<rdf:RDF[\s>]/i.test(head)) return true;
  return false;
}

export function hasFeedItems(xmlText: string): boolean {
  return /<item[\s>]/i.test(xmlText) || /<entry[\s>]/i.test(xmlText);
}
