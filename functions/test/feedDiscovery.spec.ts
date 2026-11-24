/**
 * Unit tests for feed discovery (no network).
 * Run with: yarn workspace functions vitest run test/feedDiscovery.spec.ts
 */

import { describe, it, expect } from 'vitest';
import {
  discoverFeedUrl,
  looksLikeFeed,
  hasFeedItems,
  extractSiteUrl,
  faviconUrlFor,
  feedFaviconUrl,
} from '../lib/feedDiscovery';

const page = (head: string) => `<!DOCTYPE html><html><head>${head}</head><body><p>hi</p></body></html>`;

describe('discoverFeedUrl', () => {
  it('finds an absolute RSS link', () => {
    const html = page('<link rel="alternate" type="application/rss+xml" href="https://example.com/feed.xml">');
    expect(discoverFeedUrl(html, 'https://example.com/')).toBe('https://example.com/feed.xml');
  });

  it('finds an Atom link', () => {
    const html = page('<link rel="alternate" type="application/atom+xml" href="https://example.com/atom">');
    expect(discoverFeedUrl(html, 'https://example.com/')).toBe('https://example.com/atom');
  });

  it('resolves root-relative and path-relative hrefs against the page URL', () => {
    expect(discoverFeedUrl(
      page('<link rel="alternate" type="application/rss+xml" href="/feed/">'),
      'https://example.com/blog/post',
    )).toBe('https://example.com/feed/');
    expect(discoverFeedUrl(
      page('<link rel="alternate" type="application/rss+xml" href="feed.xml">'),
      'https://example.com/blog/',
    )).toBe('https://example.com/blog/feed.xml');
    expect(discoverFeedUrl(
      page('<link rel="alternate" type="application/rss+xml" href="//cdn.example.net/rss">'),
      'https://example.com/',
    )).toBe('https://cdn.example.net/rss');
  });

  it('takes the first feed link in document order', () => {
    const html = page(
      '<link rel="alternate" type="application/rss+xml" title="Posts" href="/feed/">' +
      '<link rel="alternate" type="application/rss+xml" title="Comments" href="/comments/feed/">',
    );
    expect(discoverFeedUrl(html, 'https://example.com/')).toBe('https://example.com/feed/');
  });

  it('matches rel tokens and type case-insensitively, ignoring type parameters', () => {
    const html = page('<link rel="Alternate home" type="Application/RSS+XML; charset=utf-8" href="/rss">');
    expect(discoverFeedUrl(html, 'https://example.com/')).toBe('https://example.com/rss');
  });

  it('ignores non-feed alternates and non-alternate feed types', () => {
    const html = page(
      '<link rel="alternate" hreflang="ja" href="/ja/">' +
      '<link rel="alternate" type="application/json+oembed" href="/oembed">' +
      '<link rel="stylesheet" type="application/rss+xml" href="/not-a-feed">',
    );
    expect(discoverFeedUrl(html, 'https://example.com/')).toBeNull();
  });

  it('skips non-http(s) and empty hrefs', () => {
    const html = page(
      '<link rel="alternate" type="application/rss+xml" href="javascript:alert(1)">' +
      '<link rel="alternate" type="application/rss+xml" href="">' +
      '<link rel="alternate" type="application/rss+xml" href="/ok">',
    );
    expect(discoverFeedUrl(html, 'https://example.com/')).toBe('https://example.com/ok');
  });

  it('returns null for pages without feed links and for empty input', () => {
    expect(discoverFeedUrl(page('<title>x</title>'), 'https://example.com/')).toBeNull();
    expect(discoverFeedUrl('', 'https://example.com/')).toBeNull();
  });
});

describe('looksLikeFeed / hasFeedItems', () => {
  it('rejects HTML and accepts RSS, Atom and RDF', () => {
    expect(looksLikeFeed(page(''))).toBe(false);
    expect(looksLikeFeed('<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>')).toBe(true);
    expect(looksLikeFeed('<feed xmlns="http://www.w3.org/2005/Atom"></feed>')).toBe(true);
    expect(looksLikeFeed('<rdf:RDF xmlns:rdf="x"></rdf:RDF>')).toBe(true);
  });

  it('detects items and entries', () => {
    expect(hasFeedItems('<rss><channel><item><title>a</title></item></channel></rss>')).toBe(true);
    expect(hasFeedItems('<feed><entry></entry></feed>')).toBe(true);
    expect(hasFeedItems('<rss><channel></channel></rss>')).toBe(false);
  });
});

// Header of http://feeds.rocketnews24.com/rocketnews24 (2026-11-24)
const ROCKETNEWS = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
	<title>ロケットニュース24</title>
	<atom:link href="https://rocketnews24.com/feed/" rel="self" type="application/rss+xml" />
	<link>https://rocketnews24.com</link>
	<item><title>A</title><link>https://rocketnews24.com/2026/11/24/1/</link></item>
</channel></rss>`;

describe('extractSiteUrl', () => {
  it('reads the RSS channel link, skipping atom:link rel=self', () => {
    expect(extractSiteUrl(ROCKETNEWS, 'http://feeds.rocketnews24.com/rocketnews24')).toBe('https://rocketnews24.com/');
  });

  it('reads the Atom alternate link and skips rel=self', () => {
    const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><title>X</title>
      <link rel="self" href="https://feeds.example.com/atom"/>
      <link rel="alternate" type="text/html" href="https://example.com/blog/"/>
      <entry><link href="https://example.com/blog/1"/></entry></feed>`;
    expect(extractSiteUrl(atom, 'https://feeds.example.com/atom')).toBe('https://example.com/blog/');
  });

  it('treats an Atom link without rel as alternate and resolves relative URLs', () => {
    const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><link href="/"/><entry></entry></feed>`;
    expect(extractSiteUrl(atom, 'https://example.com/atom.xml')).toBe('https://example.com/');
  });

  it('accepts CDATA and ignores item links', () => {
    const rss = `<rss><channel><link><![CDATA[https://example.org/]]></link><item><link>https://other.org/1</link></item></channel></rss>`;
    expect(extractSiteUrl(rss, 'https://feeds.example.org/rss')).toBe('https://example.org/');
    const noChannelLink = `<rss><channel><title>x</title><item><link>https://other.org/1</link></item></channel></rss>`;
    expect(extractSiteUrl(noChannelLink, 'https://feeds.example.org/rss')).toBeNull();
  });

  it('rejects non-http links', () => {
    const rss = `<rss><channel><link>javascript:alert(1)</link></channel></rss>`;
    expect(extractSiteUrl(rss, 'https://example.org/rss')).toBeNull();
  });
});

describe('feedFaviconUrl', () => {
  it('uses the site host rather than the feed host', () => {
    expect(feedFaviconUrl('http://feeds.rocketnews24.com/rocketnews24', ROCKETNEWS))
      .toBe('https://www.google.com/s2/favicons?domain=rocketnews24.com&sz=32');
  });

  it('prefers the site URL the user entered', () => {
    expect(feedFaviconUrl('https://feeds.feedburner.com/x', ROCKETNEWS, 'https://blog.example.com/'))
      .toBe('https://www.google.com/s2/favicons?domain=blog.example.com&sz=32');
  });

  it('falls back to the feed host', () => {
    expect(feedFaviconUrl('https://example.com/feed', '<rss><channel><title>x</title></channel></rss>'))
      .toBe(faviconUrlFor('https://example.com/feed'));
    expect(faviconUrlFor('not a url')).toBe('');
  });
});
