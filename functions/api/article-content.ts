/**
 * GET /api/article-content?url={articleUrl}
 * Extract readable article content from a URL using Readability
 *
 * Used for in-app reader mode in mobile app
 */

import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';

interface ArticleContent {
  title: string | null;
  content: string | null;
  textContent: string | null;
  excerpt: string | null;
  byline: string | null;
  siteName: string | null;
  length: number;
}

export async function onRequestGet(context: any): Promise<Response> {
  try {
    const { request } = context;
    const requestUrl = new URL(request.url);
    const articleUrl = requestUrl.searchParams.get('url');

    if (!articleUrl) {
      return new Response(
        JSON.stringify({ error: 'URL parameter is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(articleUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid URL provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the article HTML
    const response = await fetch(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FeedOwn/1.0; +https://feedown.pages.dev)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch article: ${response.status}` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();

    // Parse HTML with linkedom
    const { document } = parseHTML(html);

    // Set base URL for relative links
    const baseElement = document.createElement('base');
    baseElement.href = articleUrl;
    document.head.prepend(baseElement);

    // Extract article content with Readability
    const reader = new Readability(document as any, {
      charThreshold: 100,
    });
    const article = reader.parse();

    if (!article) {
      return new Response(
        JSON.stringify({
          error: 'Could not extract article content',
          success: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Process content to fix relative URLs
    let processedContent = article.content || '';

    // Fix relative image URLs
    processedContent = processedContent.replace(
      /src="(?!https?:\/\/|data:)([^"]+)"/g,
      (match, src) => {
        try {
          const absoluteUrl = new URL(src, articleUrl).href;
          return `src="${absoluteUrl}"`;
        } catch {
          return match;
        }
      }
    );

    // Fix relative link URLs
    processedContent = processedContent.replace(
      /href="(?!https?:\/\/|mailto:|tel:|#)([^"]+)"/g,
      (match, href) => {
        try {
          const absoluteUrl = new URL(href, articleUrl).href;
          return `href="${absoluteUrl}"`;
        } catch {
          return match;
        }
      }
    );

    const result: ArticleContent = {
      title: article.title,
      content: processedContent,
      textContent: article.textContent,
      excerpt: article.excerpt,
      byline: article.byline,
      siteName: article.siteName,
      length: article.length,
    };

    return new Response(
      JSON.stringify({ success: true, article: result }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        }
      }
    );
  } catch (error: any) {
    console.error('Article content extraction error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to extract article content',
        details: error.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
