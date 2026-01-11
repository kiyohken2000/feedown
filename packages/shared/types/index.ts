/**
 * FeedOwn Shared Types
 */

export interface Feed {
  id: string;
  url: string;
  title: string;
  description?: string;
  lastFetchedAt: Date;
  lastSuccessAt: Date;
  errorCount: number;
  addedAt: Date;
}

export interface Article {
  id: string;
  feedId: string;
  title: string;
  url: string;
  content: string;
  publishedAt: Date;
  fetchedAt: Date;
  expiresAt: Date;
}

export interface ReadArticle {
  id: string;
  readAt: Date;
}

export interface Favorite {
  id: string;
  title: string;
  url: string;
  content: string;
  feedTitle: string;
  savedAt: Date;
}

export interface User {
  uid: string;
  email: string;
  createdAt: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
