/**
 * RSS/Atom feed parser utility
 */

import { parseRssDate } from './date.js';

export interface ParsedFeed {
  title: string;
  description?: string;
  link?: string;
  items: ParsedArticle[];
}

export interface ParsedArticle {
  guid: string;
  title: string;
  link: string;
  content: string;
  publishedAt: Date;
  author?: string;
}

/**
 * Get text content from XML element
 */
function getElementText(element: Element | null | undefined, tagName: string): string {
  if (!element) return '';
  const el = element.getElementsByTagName(tagName)[0];
  return el?.textContent?.trim() || '';
}

/**
 * Get CDATA content or text content
 */
function getContent(element: Element): string {
  // Try content:encoded first (common in RSS feeds)
  const contentEncoded = element.getElementsByTagNameNS(
    'http://purl.org/rss/1.0/modules/content/',
    'encoded'
  )[0];
  if (contentEncoded?.textContent) {
    return contentEncoded.textContent.trim();
  }

  // Try description
  const description = getElementText(element, 'description');
  if (description) return description;

  // Try summary (Atom)
  const summary = getElementText(element, 'summary');
  if (summary) return summary;

  // Fallback to empty
  return '';
}

/**
 * Parse RSS 2.0 feed
 */
function parseRss(doc: Document): ParsedFeed {
  const channel = doc.querySelector('channel');
  if (!channel) {
    throw new Error('Invalid RSS feed: no channel element');
  }

  const title = getElementText(channel, 'title');
  const description = getElementText(channel, 'description');
  const link = getElementText(channel, 'link');

  const items: ParsedArticle[] = [];
  const itemElements = channel.getElementsByTagName('item');

  for (let i = 0; i < itemElements.length; i++) {
    const item = itemElements[i];
    const guid = getElementText(item, 'guid') || getElementText(item, 'link');
    const itemTitle = getElementText(item, 'title');
    const itemLink = getElementText(item, 'link');
    const content = getContent(item);
    const pubDate = getElementText(item, 'pubDate');
    const author = getElementText(item, 'author') || getElementText(item, 'dc:creator');

    if (!guid || !itemTitle) continue;

    items.push({
      guid,
      title: itemTitle,
      link: itemLink,
      content,
      publishedAt: parseRssDate(pubDate),
      author: author || undefined,
    });
  }

  return { title, description, link, items };
}

/**
 * Parse Atom feed
 */
function parseAtom(doc: Document): ParsedFeed {
  const feed = doc.querySelector('feed');
  if (!feed) {
    throw new Error('Invalid Atom feed: no feed element');
  }

  const title = getElementText(feed, 'title');
  const subtitle = getElementText(feed, 'subtitle');
  const linkEl = feed.querySelector('link[rel="alternate"]') || feed.querySelector('link');
  const link = linkEl?.getAttribute('href') || '';

  const items: ParsedArticle[] = [];
  const entries = feed.getElementsByTagName('entry');

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const guid = getElementText(entry, 'id');
    const entryTitle = getElementText(entry, 'title');
    const entryLinkEl = entry.querySelector('link[rel="alternate"]') || entry.querySelector('link');
    const entryLink = entryLinkEl?.getAttribute('href') || '';
    const content = getContent(entry);
    const published = getElementText(entry, 'published') || getElementText(entry, 'updated');
    const authorEl = entry.querySelector('author name');
    const author = authorEl?.textContent?.trim();

    if (!guid || !entryTitle) continue;

    items.push({
      guid,
      title: entryTitle,
      link: entryLink,
      content,
      publishedAt: parseRssDate(published),
      author: author || undefined,
    });
  }

  return { title, description: subtitle, link, items };
}

/**
 * Parse RSS or Atom feed XML
 */
export function parseRssFeed(xmlString: string): ParsedFeed {
  // Parse XML
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  // Check for parsing errors
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Failed to parse XML: ' + parserError.textContent);
  }

  // Detect feed type and parse accordingly
  if (doc.querySelector('rss')) {
    return parseRss(doc);
  } else if (doc.querySelector('feed')) {
    return parseAtom(doc);
  } else {
    throw new Error('Unknown feed format (not RSS or Atom)');
  }
}

/**
 * Truncate content to specified length
 */
export function truncateContent(content: string, maxLength: number = 10000): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '...';
}

/**
 * Strip HTML tags from content
 */
export function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}
