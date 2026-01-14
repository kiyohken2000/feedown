/**
 * POST /api/articles/batch-read
 * Mark multiple articles as read in a single request
 * Uses retry logic to handle race conditions
 */

import { requireAuth, getFirebaseConfig } from '../../lib/auth';
import { getDocument, setDocument, getLastSetDocumentError } from '../../lib/firebase-rest';

const MAX_RETRIES = 3;

async function updateUserStateWithRetry(
  uid: string,
  articleIds: string[],
  idToken: string,
  config: any
): Promise<{ success: boolean; added: number; total: number; debug?: string }> {
  const debugInfo: string[] = [];

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      debugInfo.push(`attempt${attempt + 1}`);

      // Get current userState (fresh read on each attempt)
      const userState = await getDocument(`users/${uid}/userState/main`, idToken, config);
      const currentIds: string[] = userState?.readArticleIds || [];
      const currentSet = new Set(currentIds);

      debugInfo.push(`currentIds:${currentIds.length}`);

      // Filter out already read articles
      const newIds = articleIds.filter((id: string) => !currentSet.has(id));
      debugInfo.push(`newIds:${newIds.length}`);

      if (newIds.length === 0) {
        // All articles already read
        return { success: true, added: 0, total: currentIds.length, debug: debugInfo.join(',') };
      }

      // Add new IDs to the array
      const updatedIds = [...currentIds, ...newIds];
      debugInfo.push(`updatedIds:${updatedIds.length}`);

      const success = await setDocument(
        `users/${uid}/userState/main`,
        {
          readArticleIds: updatedIds,
          lastUpdated: new Date(),
        },
        idToken,
        config
      );

      debugInfo.push(`setDoc:${success}`);
      if (!success) {
        debugInfo.push(`err:${getLastSetDocumentError()}`);
      }

      if (success) {
        return { success: true, added: newIds.length, total: updatedIds.length, debug: debugInfo.join(',') };
      }

      // If failed, wait a bit before retrying
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
      }
    } catch (error) {
      debugInfo.push(`error:${error instanceof Error ? error.message : String(error)}`);
      console.error(`[batch-read] Attempt ${attempt + 1} failed:`, error);
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
      }
    }
  }

  // All retries failed, but return success anyway (read marks are not critical)
  console.warn(`[batch-read] All retries failed for user ${uid}, returning success anyway`);
  return { success: true, added: 0, total: 0, debug: debugInfo.join(',') + ',allFailed' };
}

export async function onRequestPost(context: any): Promise<Response> {
  try {
    const { request, env } = context;

    // Require authentication
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { uid, idToken } = authResult;

    // Parse request body
    const body = await request.json();
    const articleIds: string[] = body.articleIds;

    if (!articleIds || !Array.isArray(articleIds) || articleIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'articleIds array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const config = getFirebaseConfig(env);

    // Update with retry logic
    const result = await updateUserStateWithRetry(uid, articleIds, idToken, config);

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Batch read error:', error);
    // Return success even on error (read marks are not critical)
    return new Response(
      JSON.stringify({ success: true, added: 0, total: 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
