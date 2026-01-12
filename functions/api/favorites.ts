/**
 * GET /api/favorites
 * Get user's favorite articles
 */

import { requireAuth, getFirebaseConfig } from '../lib/auth';
import { listDocuments } from '../lib/firebase-rest';

/**
 * GET /api/favorites
 * Get all favorite articles for authenticated user
 */
export async function onRequestGet(context: any): Promise<Response> {
  try {
    const { request, env } = context;

    // Require authentication
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { uid, idToken } = authResult;

    const config = getFirebaseConfig(env);

    // Get all favorites
    const favorites = await listDocuments(
      `users/${uid}/favorites`,
      idToken,
      config,
      1000
    );

    // Transform to expected format
    const formattedFavorites = favorites.map(fav => ({
      articleId: fav.id,
      articleTitle: fav.title,
      articleDescription: fav.description || '',
      articleLink: fav.url,
      feedTitle: fav.feedTitle || '',
      imageUrl: fav.imageUrl || null,
      savedAt: fav.savedAt,
    }));

    // Sort by savedAt descending
    formattedFavorites.sort((a, b) => {
      const aTime = a.savedAt ? new Date(a.savedAt).getTime() : 0;
      const bTime = b.savedAt ? new Date(b.savedAt).getTime() : 0;
      return bTime - aTime;
    });

    return new Response(
      JSON.stringify({
        favorites: formattedFavorites,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Get favorites error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get favorites' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
