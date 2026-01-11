# @feedown/shared

Shared types, API client, and utilities for FeedOwn.

## Overview

This package provides common functionality used across web and mobile apps:
- TypeScript type definitions
- API client with authentication
- Utility functions (hashing, dates, RSS parsing)

## Installation

This is a workspace package, automatically available to other workspaces:

```typescript
import { FeedOwnAPI, createApiClient } from '@feedown/shared';
```

## Usage

### API Client

```typescript
import { createApiClient, FeedOwnAPI } from '@feedown/shared';

// Create client
const client = createApiClient(
  'https://feedown-myname.pages.dev',
  async () => {
    // Return current auth token
    return await firebase.auth().currentUser?.getIdToken() || null;
  }
);

// Create API instance
const api = new FeedOwnAPI(client);

// Use API
const result = await api.feeds.list();
if (result.success) {
  console.log(result.data.feeds);
} else {
  console.error(result.error);
}
```

### Available APIs

```typescript
// Auth
await api.auth.login(email, password);
await api.auth.register(email, password);
await api.auth.logout();

// Feeds
await api.feeds.list();
await api.feeds.add(url);
await api.feeds.delete(feedId);
await api.feeds.testFeed(url);

// Articles
await api.articles.list({ feedId, unreadOnly, limit, offset });
await api.articles.markAsRead(articleId);
await api.articles.addToFavorites(articleId);
await api.articles.removeFromFavorites(articleId);

// Refresh
await api.refresh.refreshAll();
await api.refresh.refreshFeed(feedId);

// Favorites
await api.favorites.list();

// OPML
await api.opml.import(opmlContent);
await api.opml.export();
```

### Types

```typescript
import type { Feed, Article, User, ApiResponse } from '@feedown/shared';

const feed: Feed = {
  id: '123',
  url: 'https://example.com/rss',
  title: 'Example Feed',
  lastFetchedAt: new Date(),
  lastSuccessAt: new Date(),
  errorCount: 0,
  addedAt: new Date(),
};
```

### Utilities

```typescript
import {
  generateArticleHash,
  formatRelativeTime,
  parseRssFeed,
} from '@feedown/shared';

// Generate article hash
const hash = await generateArticleHash(feedId, articleGuid);

// Format dates
const relativeTime = formatRelativeTime(new Date()); // "2 hours ago"

// Parse RSS feed
const parsed = parseRssFeed(xmlString);
console.log(parsed.title, parsed.items);
```

## API Reference

### Hash Utilities

- `generateHash(input: string): Promise<string>` - Generate SHA-256 hash
- `generateArticleHash(feedId: string, guid: string): Promise<string>` - Generate article ID
- `simpleHash(str: string): string` - Fast non-cryptographic hash

### Date Utilities

- `formatRelativeTime(date: Date): string` - Format as "X time ago"
- `formatShortDate(date: Date): string` - Format as "Jan 15, 2024"
- `formatFullDate(date: Date): string` - Format with time
- `isWithinHours(date: Date, hours: number): boolean` - Check freshness
- `getExpirationDate(days: number): Date` - Calculate expiration
- `parseRssDate(dateString: string): Date` - Parse RSS date

### RSS Parser

- `parseRssFeed(xmlString: string): ParsedFeed` - Parse RSS/Atom XML
- `truncateContent(content: string, maxLength?: number): string` - Truncate text
- `stripHtmlTags(html: string): string` - Remove HTML tags

## Type Definitions

### Feed
```typescript
interface Feed {
  id: string;
  url: string;
  title: string;
  description?: string;
  lastFetchedAt: Date;
  lastSuccessAt: Date;
  errorCount: number;
  addedAt: Date;
}
```

### Article
```typescript
interface Article {
  id: string;
  feedId: string;
  title: string;
  url: string;
  content: string;
  publishedAt: Date;
  fetchedAt: Date;
  expiresAt: Date;
}
```

### ApiResponse
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

## Development

```bash
# Build TypeScript
yarn workspace @feedown/shared build

# Watch mode
yarn workspace @feedown/shared dev
```
