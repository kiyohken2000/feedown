/**
 * Hash utilities for generating article IDs
 */

/**
 * Generate MD5-like hash from string
 * Uses SHA-256 and truncates to 32 characters for compatibility
 */
export async function generateHash(input: string): Promise<string> {
  // Use Web Crypto API (available in browsers and modern Node.js)
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Return first 32 characters to match MD5 length
  return hashHex.substring(0, 32);
}

/**
 * Generate article hash from feedId and article GUID
 */
export async function generateArticleHash(feedId: string, guid: string): Promise<string> {
  return generateHash(`${feedId}:${guid}`);
}

/**
 * Synchronous simple hash for non-critical use cases
 * Not cryptographically secure, but fast and consistent
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
