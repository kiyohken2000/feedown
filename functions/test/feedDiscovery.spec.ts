/**
 * Unit tests for feed discovery (no network).
 * Run with: yarn workspace functions vitest run test/feedDiscovery.spec.ts
 */

import { describe, it, expect } from 'vitest';
import { discoverFeedUrl, looksLikeFeed, hasFeedItems } from '../lib/feedDiscovery';

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
