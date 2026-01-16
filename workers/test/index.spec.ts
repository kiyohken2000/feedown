import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import worker from '../src/index';

describe('FeedOwn Worker', () => {
  describe('GET /fetch', () => {
    it('should return 400 when url parameter is missing', async () => {
      const request = new Request('http://localhost/fetch');
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json).toHaveProperty('error', 'Missing url parameter');
    });

    it('should return 400 for invalid URL', async () => {
      const request = new Request('http://localhost/fetch?url=not-a-url');
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json).toHaveProperty('error', 'Invalid URL');
    });

    it('should return 400 for non-http URL', async () => {
      const request = new Request('http://localhost/fetch?url=ftp://example.com/feed');
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json).toHaveProperty('error', 'Invalid URL');
    });

    it('should fetch valid RSS feed', async () => {
      // Use a reliable RSS feed for testing
      const feedUrl = 'https://hnrss.org/frontpage';
      const request = new Request(`http://localhost/fetch?url=${encodeURIComponent(feedUrl)}`);
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/xml');

      const xml = await response.text();
      expect(xml).toContain('<?xml');
      expect(xml).toContain('<rss');
    });

    it('should include CORS headers', async () => {
      const request = new Request('http://localhost/fetch?url=https://hnrss.org/frontpage');
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should cache responses and return X-Cache header', async () => {
      const feedUrl = 'https://hnrss.org/frontpage';
      const request = new Request(`http://localhost/fetch?url=${encodeURIComponent(feedUrl)}`);

      // First request - should be MISS
      const ctx1 = createExecutionContext();
      const response1 = await worker.fetch(request, env, ctx1);
      await waitOnExecutionContext(ctx1);
      expect(response1.status).toBe(200);
      // Note: First request might be HIT if previously cached

      // Second request - should be HIT
      const ctx2 = createExecutionContext();
      const response2 = await worker.fetch(request, env, ctx2);
      await waitOnExecutionContext(ctx2);
      expect(response2.status).toBe(200);
      expect(response2.headers.get('X-Cache')).toBe('HIT');
    });

    it('should bypass cache when bypass_cache=1', async () => {
      const feedUrl = 'https://hnrss.org/frontpage';
      const request = new Request(`http://localhost/fetch?url=${encodeURIComponent(feedUrl)}&bypass_cache=1`);
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Cache')).toBe('MISS');
    });
  });

  describe('OPTIONS (CORS preflight)', () => {
    it('should handle OPTIONS request', async () => {
      const request = new Request('http://localhost/fetch', { method: 'OPTIONS' });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    });
  });

  describe('Unknown routes', () => {
    it('should return 404 for unknown paths', async () => {
      const request = new Request('http://localhost/unknown');
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(404);
    });
  });
});
