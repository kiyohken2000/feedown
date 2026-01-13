/**
 * /api/articles/:id/favorite
 * POST: Add to favorites
 * DELETE: Remove from favorites
 */

import { requireAuth, getFirebaseConfig, isTestAccount } from '../../../lib/auth';
import { setDocument, deleteDocument, listDocuments } from '../../../lib/firebase-rest';

/**
 * POST /api/articles/:id/favorite
 * Add article to favorites
 */
export async function onRequestPost(context: any): Promise<Response> {
  try {
    const { request, env, params } = context;

    // Require authentication
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { uid, idToken, email } = authResult;

    const articleId = params.id;
    if (!articleId) {
      return new Response(
        JSON.stringify({ error: 'Article ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get article data from request body
    const body = await request.json();
    const { title, url, description, feedTitle, imageUrl } = body;

    if (!title || !url) {
      return new Response(
        JSON.stringify({ error: 'Article title and URL are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const config = getFirebaseConfig(env);

    // Check favorites limit for test accounts
    // Test accounts (test-*@test.com): max 10 favorites
    // Regular accounts: unlimited
    const isTest = isTestAccount(email);
    if (isTest) {
      const existingFavorites = await listDocuments(
        `users/${uid}/favorites`,
        idToken,
        config,
        100
      );

      if (existingFavorites.length >= 10) {
        return new Response(
          JSON.stringify({
            error: 'Test accounts can only have up to 10 favorites. Please use a regular account for more favorites.'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Add to favorites
    const success = await setDocument(
      `users/${uid}/favorites/${articleId}`,
      {
        title,
        url,
        description: description || '',
        feedTitle: feedTitle || '',
        imageUrl: imageUrl || null,
        savedAt: new Date(),
      },
      idToken,
      config
    );

    if (!success) {
      return new Response(
        JSON.stringify({ error: 'Failed to add to favorites' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Add favorite error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to add to favorites' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * DELETE /api/articles/:id/favorite
 * Remove article from favorites
 */
export async function onRequestDelete(context: any): Promise<Response> {
  try {
    const { request, env, params } = context;

    // Require authentication
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { uid, idToken } = authResult;

    const articleId = params.id;
    if (!articleId) {
      return new Response(
        JSON.stringify({ error: 'Article ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const config = getFirebaseConfig(env);

    // Remove from favorites
    const success = await deleteDocument(
      `users/${uid}/favorites/${articleId}`,
      idToken,
      config
    );

    if (!success) {
      return new Response(
        JSON.stringify({ error: 'Failed to remove from favorites' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Remove favorite error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to remove from favorites' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
