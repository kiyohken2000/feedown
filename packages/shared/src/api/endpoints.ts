/**
 * FeedOwn API Endpoints
 * Type-safe API endpoint definitions
 */

import type { ApiClient } from './client.js';
import type { Feed, Article, Favorite, User } from '../types/index.js';

/**
 * Auth API
 */
export class AuthAPI {
  constructor(private client: ApiClient) {}

  async login(email: string, password: string) {
    return this.client.post<{ user: User; token: string }>('/api/auth/login', {
      email,
      password,
    });
  }

  async register(email: string, password: string) {
    return this.client.post<{ user: User; token: string }>('/api/auth/register', {
      email,
      password,
    });
  }

  async logout() {
    return this.client.post<void>('/api/auth/logout');
  }
}

/**
 * Feeds API
 */
export class FeedsAPI {
  constructor(private client: ApiClient) {}

  async list() {
    return this.client.get<{ feeds: Feed[] }>('/api/feeds');
  }

  async add(url: string) {
    return this.client.post<{ feed: Feed }>('/api/feeds', { url });
  }

  async delete(feedId: string) {
    return this.client.delete<void>(`/api/feeds/${feedId}`);
  }

  async update(feedId: string, data: { order?: number }) {
    return this.client.patch<void>(`/api/feeds/${feedId}`, data);
  }

  async testFeed(url: string) {
    return this.client.post<{ valid: boolean; title?: string; error?: string }>(
      '/api/test-feed',
      { url }
    );
  }
}

/**
 * Articles API
 */
export class ArticlesAPI {
  constructor(private client: ApiClient) {}

  async list(params?: { feedId?: string; unreadOnly?: boolean; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params?.feedId) query.set('feedId', params.feedId);
    if (params?.unreadOnly) query.set('unreadOnly', 'true');
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());

    const queryString = query.toString();
    return this.client.get<{ articles: Article[]; total: number }>(
      `/api/articles${queryString ? `?${queryString}` : ''}`
    );
  }

  async markAsRead(articleId: string) {
    return this.client.post<void>(`/api/articles/${articleId}/read`);
  }

  async batchMarkAsRead(articleIds: string[]) {
    return this.client.post<{ added: number; total: number }>('/api/articles/batch-read', { articleIds });
  }

  async addToFavorites(articleId: string, articleData: { title: string; url: string; description?: string; feedTitle?: string }) {
    return this.client.post<void>(`/api/articles/${articleId}/favorite`, articleData);
  }

  async removeFromFavorites(articleId: string) {
    return this.client.delete<void>(`/api/articles/${articleId}/favorite`);
  }
}

/**
 * Refresh API
 */
export class RefreshAPI {
  constructor(private client: ApiClient) {}

  async refreshAll() {
    return this.client.post<{ refreshed: number; errors: number }>('/api/refresh');
  }

  async refreshFeed(feedId: string) {
    return this.client.post<{ refreshed: number }>('/api/refresh', { feedId });
  }
}

/**
 * Favorites API
 */
export class FavoritesAPI {
  constructor(private client: ApiClient) {}

  async list() {
    return this.client.get<{ favorites: Favorite[] }>('/api/favorites');
  }
}

/**
 * OPML API
 */
export class OpmlAPI {
  constructor(private client: ApiClient) {}

  async import(opmlContent: string) {
    return this.client.post<{ imported: number; errors: number }>('/api/opml/import', {
      opml: opmlContent,
    });
  }

  async export() {
    return this.client.get<{ opml: string }>('/api/opml/export');
  }
}

/**
 * User Account API
 */
export class UserAPI {
  constructor(private client: ApiClient) {}

  async deleteAccount() {
    return this.client.delete<void>('/api/user/account');
  }

  async clearAllData() {
    return this.client.delete<void>('/api/user/data');
  }
}

/**
 * Main API class combining all endpoints
 */
export class FeedOwnAPI {
  public auth: AuthAPI;
  public feeds: FeedsAPI;
  public articles: ArticlesAPI;
  public refresh: RefreshAPI;
  public favorites: FavoritesAPI;
  public opml: OpmlAPI;
  public user: UserAPI;

  constructor(client: ApiClient) {
    this.auth = new AuthAPI(client);
    this.feeds = new FeedsAPI(client);
    this.articles = new ArticlesAPI(client);
    this.refresh = new RefreshAPI(client);
    this.favorites = new FavoritesAPI(client);
    this.opml = new OpmlAPI(client);
    this.user = new UserAPI(client);
  }
}
