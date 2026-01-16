/**
 * FeedOwn API Integration Tests
 *
 * These tests run against the production API (https://feedown.pages.dev)
 * They test the actual API behavior including authentication flow.
 */

import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = process.env.API_BASE_URL || 'https://feedown.pages.dev';

// Test account credentials
const TEST_EMAIL = `api-test-${Date.now()}@test.com`;
const TEST_PASSWORD = '111111';

let authToken: string | null = null;

describe('FeedOwn API Integration Tests', () => {
  describe('Public Endpoints', () => {
    it('GET /api/recommended-feeds - should return recommended feeds', async () => {
      const response = await fetch(`${BASE_URL}/api/recommended-feeds`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('feeds');
      expect(Array.isArray(data.feeds)).toBe(true);

      if (data.feeds.length > 0) {
        expect(data.feeds[0]).toHaveProperty('name');
        expect(data.feeds[0]).toHaveProperty('url');
      }
    });

    it('GET /api/article-content - should return 400 without url parameter', async () => {
      const response = await fetch(`${BASE_URL}/api/article-content`);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('GET /api/article-content - should extract article content', async () => {
      const testUrl = 'https://example.com';
      const response = await fetch(
        `${BASE_URL}/api/article-content?url=${encodeURIComponent(testUrl)}`
      );
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('success');
    });
  });

  describe('Authentication', () => {
    it('POST /api/auth/login - should return 400 without credentials', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(400);
    });

    it('POST /api/auth/login - should return 401 for invalid credentials', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@test.com',
          password: 'wrongpassword',
        }),
      });
      expect(response.status).toBe(401);
    });

    it('POST /api/auth/register - should return 400 for short password', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@test.com',
          password: '123',
        }),
      });
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('6 characters');
    });

    it('POST /api/auth/register - should create new account', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        }),
      });
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('token');
      expect(data).toHaveProperty('user');
      expect(data.user).toHaveProperty('uid');
      expect(data.user).toHaveProperty('email', TEST_EMAIL);

      // Save token for subsequent tests
      authToken = data.token;
    });

    it('POST /api/auth/login - should login with valid credentials', async () => {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        }),
      });
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('token');

      authToken = data.token;
    });
  });

  describe('Protected Endpoints (require auth)', () => {
    beforeAll(async () => {
      // Ensure we have a token
      if (!authToken) {
        const response = await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
          }),
        });
        const data = await response.json();
        authToken = data.token;
      }
    });

    it('GET /api/feeds - should return 401 without auth', async () => {
      const response = await fetch(`${BASE_URL}/api/feeds`);
      expect(response.status).toBe(401);
    });

    it('GET /api/feeds - should return feeds with auth', async () => {
      const response = await fetch(`${BASE_URL}/api/feeds`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('feeds');
      expect(Array.isArray(data.feeds)).toBe(true);
    });

    it('POST /api/feeds - should add a feed', async () => {
      const response = await fetch(`${BASE_URL}/api/feeds`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: 'https://hnrss.org/frontpage',
        }),
      });
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('feed');
      expect(data.feed).toHaveProperty('id');
      expect(data.feed).toHaveProperty('url', 'https://hnrss.org/frontpage');
    });

    it('GET /api/articles - should return 401 without auth', async () => {
      const response = await fetch(`${BASE_URL}/api/articles`);
      expect(response.status).toBe(401);
    });

    it('GET /api/articles - should return articles with auth', async () => {
      const response = await fetch(`${BASE_URL}/api/articles`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('articles');
      expect(Array.isArray(data.articles)).toBe(true);
      expect(data).toHaveProperty('shouldRefresh');
      expect(data).toHaveProperty('hasMore');
    });

    it('GET /api/favorites - should return favorites with auth', async () => {
      const response = await fetch(`${BASE_URL}/api/favorites`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('favorites');
      expect(Array.isArray(data.favorites)).toBe(true);
    });

    it('POST /api/refresh - should trigger feed refresh', async () => {
      const response = await fetch(`${BASE_URL}/api/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('stats');
      expect(data.stats).toHaveProperty('totalFeeds');
      expect(data.stats).toHaveProperty('successfulFeeds');
      expect(data.stats).toHaveProperty('newArticles');
    });

    it('POST /api/articles/batch-read - should mark articles as read', async () => {
      const response = await fetch(`${BASE_URL}/api/articles/batch-read`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articleIds: ['test-article-1', 'test-article-2'],
        }),
      });
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('success', true);
    });
  });

  describe('Test Account Limits', () => {
    it('POST /api/feeds - should enforce 3 feed limit for test accounts', async () => {
      // First, add 2 more feeds to hit the limit
      await fetch(`${BASE_URL}/api/feeds`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: 'https://feeds.bbci.co.uk/news/rss.xml' }),
      });

      await fetch(`${BASE_URL}/api/feeds`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' }),
      });

      // Try to add a 4th feed - should fail
      const response = await fetch(`${BASE_URL}/api/feeds`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: 'https://feeds.arstechnica.com/arstechnica/index' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Test accounts');
    });
  });

  describe('Cleanup', () => {
    it('DELETE /api/user/data - should clear all user data', async () => {
      const response = await fetch(`${BASE_URL}/api/user/data`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('success', true);
    });

    it('DELETE /api/user/account - should delete user account', async () => {
      const response = await fetch(`${BASE_URL}/api/user/account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('success', true);
    });
  });
});
