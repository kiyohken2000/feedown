/**
 * Firebase REST API Helper
 * Cloudflare Workers compatible Firebase client using REST API
 */

export interface FirebaseConfig {
  apiKey: string;
  projectId: string;
  authDomain?: string;
}

export interface FirestoreDocument {
  name: string;
  fields: Record<string, any>;
  createTime?: string;
  updateTime?: string;
}

export interface VerifiedUser {
  uid: string;
  email?: string;
  email_verified?: boolean;
}

/**
 * Verify Firebase ID Token using Firebase Auth REST API
 */
export async function verifyIdToken(
  idToken: string,
  config: FirebaseConfig
): Promise<VerifiedUser | null> {
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!response.ok) {
      console.error('Token verification failed:', response.status);
      return null;
    }

    const data: any = await response.json();

    if (!data.users || data.users.length === 0) {
      return null;
    }

    const user = data.users[0];
    return {
      uid: user.localId,
      email: user.email,
      email_verified: user.emailVerified,
    };
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

/**
 * Create a new user with email and password
 */
export async function createUser(
  email: string,
  password: string,
  config: FirebaseConfig
): Promise<{ uid: string; idToken: string } | null> {
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('User creation failed:', errorData);
      return null;
    }

    const data: any = await response.json();
    return {
      uid: data.localId,
      idToken: data.idToken,
    };
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
}

/**
 * Convert JavaScript value to Firestore field value format
 */
function toFirestoreValue(value: any): any {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { integerValue: String(value) };
    }
    return { doubleValue: value };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(toFirestoreValue),
      },
    };
  }
  if (typeof value === 'object') {
    const fields: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      fields[key] = toFirestoreValue(val);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

/**
 * Convert Firestore field value to JavaScript value
 */
function fromFirestoreValue(fieldValue: any): any {
  if (!fieldValue) return null;

  if ('nullValue' in fieldValue) return null;
  if ('stringValue' in fieldValue) return fieldValue.stringValue;
  if ('integerValue' in fieldValue) return parseInt(fieldValue.integerValue, 10);
  if ('doubleValue' in fieldValue) return fieldValue.doubleValue;
  if ('booleanValue' in fieldValue) return fieldValue.booleanValue;
  if ('timestampValue' in fieldValue) return new Date(fieldValue.timestampValue);
  if ('arrayValue' in fieldValue) {
    return (fieldValue.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ('mapValue' in fieldValue) {
    const obj: Record<string, any> = {};
    const fields = fieldValue.mapValue.fields || {};
    for (const [key, val] of Object.entries(fields)) {
      obj[key] = fromFirestoreValue(val);
    }
    return obj;
  }

  return null;
}

/**
 * Get a Firestore document
 */
export async function getDocument(
  path: string,
  idToken: string,
  config: FirebaseConfig
): Promise<any | null> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/${path}`;

    console.log(`[getDocument] Fetching: ${path}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[getDocument] Not found: ${path}`);
        return null;
      }
      const errorText = await response.text();
      console.error(`[getDocument] Failed for ${path}: ${response.status}`, errorText);
      return null;
    }

    const doc: any = await response.json();
    const result = fromFirestoreDocument(doc);
    console.log(`[getDocument] Success for ${path}:`, JSON.stringify(result).substring(0, 200));
    return result;
  } catch (error) {
    console.error('Error getting document:', error);
    return null;
  }
}

/**
 * Create a Firestore document with auto-generated ID
 */
export async function createDocument(
  collectionPath: string,
  data: any,
  idToken: string,
  config: FirebaseConfig
): Promise<{ id: string; data: any } | null> {
  try {
    const fields: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      fields[key] = toFirestoreValue(value);
    }

    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/${collectionPath}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Create document failed:', errorData);
      return null;
    }

    const doc: any = await response.json();
    const docId = doc.name.split('/').pop();

    return {
      id: docId,
      data: fromFirestoreDocument(doc),
    };
  } catch (error) {
    console.error('Error creating document:', error);
    return null;
  }
}

// Store last error for debugging
let lastSetDocumentError: string = '';

export function getLastSetDocumentError(): string {
  return lastSetDocumentError;
}

/**
 * Set a Firestore document (create or overwrite)
 */
export async function setDocument(
  path: string,
  data: any,
  idToken: string,
  config: FirebaseConfig
): Promise<boolean> {
  lastSetDocumentError = '';
  try {
    const fields: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      fields[key] = toFirestoreValue(value);
    }

    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/${path}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      lastSetDocumentError = `${response.status}:${errorText.substring(0, 200)}`;
      console.error(`[setDocument] Failed for ${path}: ${response.status}`, errorText);
      return false;
    }

    return true;
  } catch (error) {
    lastSetDocumentError = `exception:${error instanceof Error ? error.message : String(error)}`;
    console.error('Error setting document:', error);
    return false;
  }
}

/**
 * Update a Firestore document
 */
export async function updateDocument(
  path: string,
  data: any,
  idToken: string,
  config: FirebaseConfig
): Promise<boolean> {
  try {
    const fields: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      fields[key] = toFirestoreValue(value);
    }

    const updateMask = Object.keys(data).join(',');
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/${path}?updateMask.fieldPaths=${updateMask}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ fields }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error updating document:', error);
    return false;
  }
}

/**
 * Delete a Firestore document
 */
export async function deleteDocument(
  path: string,
  idToken: string,
  config: FirebaseConfig
): Promise<boolean> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/${path}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Error deleting document:', error);
    return false;
  }
}

/**
 * List documents in a collection
 * Handles pagination automatically to retrieve all documents up to maxDocuments
 */
export async function listDocuments(
  collectionPath: string,
  idToken: string,
  config: FirebaseConfig,
  maxDocuments: number = 1000
): Promise<any[]> {
  try {
    const allDocuments: any[] = [];
    let pageToken: string | null = null;
    const pageSize = Math.min(maxDocuments, 300); // Firestore max page size is 300

    do {
      let url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/${collectionPath}?pageSize=${pageSize}`;

      if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        console.error('List documents failed:', response.status);
        break;
      }

      const data: any = await response.json();
      const documents = data.documents || [];

      allDocuments.push(...documents.map((doc: any) => ({
        id: doc.name.split('/').pop(),
        ...fromFirestoreDocument(doc),
      })));

      // Get next page token
      pageToken = data.nextPageToken || null;

      // Stop if we've reached the max documents limit
      if (allDocuments.length >= maxDocuments) {
        console.log(`[listDocuments] Reached max documents limit: ${maxDocuments}`);
        break;
      }

    } while (pageToken);

    console.log(`[listDocuments] Retrieved ${allDocuments.length} documents from ${collectionPath}`);
    return allDocuments.slice(0, maxDocuments);
  } catch (error) {
    console.error('Error listing documents:', error);
    return [];
  }
}

/**
 * Convert Firestore document to plain object
 */
function fromFirestoreDocument(doc: FirestoreDocument): any {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(doc.fields || {})) {
    result[key] = fromFirestoreValue(value);
  }

  return result;
}

/**
 * Delete all documents in a collection
 */
export async function deleteCollection(
  collectionPath: string,
  idToken: string,
  config: FirebaseConfig
): Promise<boolean> {
  try {
    console.log(`[deleteCollection] Starting deletion for: ${collectionPath}`);

    // List all documents in the collection
    const documents = await listDocuments(collectionPath, idToken, config, 500);
    console.log(`[deleteCollection] Found ${documents.length} documents to delete in ${collectionPath}`);

    if (documents.length === 0) {
      console.log(`[deleteCollection] No documents to delete in ${collectionPath}`);
      return true;
    }

    // Delete each document
    const deletePromises = documents.map((doc) => {
      const docPath = `${collectionPath}/${doc.id}`;
      console.log(`[deleteCollection] Deleting document: ${docPath}`);
      return deleteDocument(docPath, idToken, config);
    });

    await Promise.all(deletePromises);
    console.log(`[deleteCollection] Successfully deleted ${documents.length} documents from ${collectionPath}`);
    return true;
  } catch (error) {
    console.error(`[deleteCollection] Error deleting collection ${collectionPath}:`, error);
    return false;
  }
}

/**
 * Query documents with WHERE clause
 * Simplified version for common use case: WHERE field = value
 * Note: Firestore 'in' operator supports max 10 values, so batch accordingly
 */
export async function queryDocuments(
  collectionPath: string,
  where: { field: string; operator: string; value: any } | Array<{ field: string; operator: string; value: any }>,
  idToken: string,
  config: FirebaseConfig,
  limit?: number
): Promise<any[]> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents:runQuery`;

    // Build WHERE clause
    const whereConditions = Array.isArray(where) ? where : [where];
    const compositeFilter: any = {
      compositeFilter: {
        op: 'AND',
        filters: whereConditions.map(condition => {
          const fieldFilter: any = {
            fieldFilter: {
              field: { fieldPath: condition.field },
              op: mapOperator(condition.operator),
              value: toFirestoreValue(condition.value),
            }
          };
          return fieldFilter;
        })
      }
    };

    const structuredQuery: any = {
      from: [{ collectionId: collectionPath.split('/').pop() }],
      where: whereConditions.length === 1 ? {
        fieldFilter: {
          field: { fieldPath: whereConditions[0].field },
          op: mapOperator(whereConditions[0].operator),
          value: toFirestoreValue(whereConditions[0].value),
        }
      } : compositeFilter,
    };

    if (limit) {
      structuredQuery.limit = limit;
    }

    // Get parent path (everything except the last segment)
    const pathParts = collectionPath.split('/');
    const parentPath = pathParts.slice(0, -1).join('/');
    const parent = parentPath
      ? `projects/${config.projectId}/databases/(default)/documents/${parentPath}`
      : `projects/${config.projectId}/databases/(default)/documents`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        structuredQuery,
        parent,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Query failed:', response.status, errorText);
      return [];
    }

    const results: any = await response.json();

    // Handle empty results
    if (!results || results.length === 0) {
      return [];
    }

    return results
      .filter((result: any) => result.document)
      .map((result: any) => ({
        id: result.document.name.split('/').pop(),
        ...fromFirestoreDocument(result.document),
      }));
  } catch (error) {
    console.error('Error querying documents:', error);
    return [];
  }
}

/**
 * Map operator string to Firestore operator enum
 */
function mapOperator(operator: string): string {
  const operatorMap: Record<string, string> = {
    '==': 'EQUAL',
    '=': 'EQUAL',
    '!=': 'NOT_EQUAL',
    '<': 'LESS_THAN',
    '<=': 'LESS_THAN_OR_EQUAL',
    '>': 'GREATER_THAN',
    '>=': 'GREATER_THAN_OR_EQUAL',
    'in': 'IN',
    'array-contains': 'ARRAY_CONTAINS',
    'array-contains-any': 'ARRAY_CONTAINS_ANY',
  };
  return operatorMap[operator.toLowerCase()] || 'EQUAL';
}

/**
 * Run a structured query
 */
export async function runQuery(
  collectionPath: string,
  query: any,
  idToken: string,
  config: FirebaseConfig
): Promise<any[]> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents:runQuery`;

    const structuredQuery: any = {
      from: [{ collectionId: collectionPath.split('/').pop() }],
    };

    if (query.where) {
      structuredQuery.where = query.where;
    }

    if (query.orderBy) {
      structuredQuery.orderBy = query.orderBy;
    }

    if (query.limit) {
      structuredQuery.limit = query.limit;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        structuredQuery,
        parent: `projects/${config.projectId}/databases/(default)/documents/${collectionPath.split('/').slice(0, -1).join('/')}`,
      }),
    });

    if (!response.ok) {
      console.error('Query failed:', response.status);
      return [];
    }

    const results: any = await response.json();

    return (results || [])
      .filter((result: any) => result.document)
      .map((result: any) => ({
        id: result.document.name.split('/').pop(),
        ...fromFirestoreDocument(result.document),
      }));
  } catch (error) {
    console.error('Error running query:', error);
    return [];
  }
}

/**
 * Batch write multiple documents in a single request
 * Firestore allows up to 500 writes per batch
 */
export async function batchSetDocuments(
  documents: Array<{ path: string; data: any }>,
  idToken: string,
  config: FirebaseConfig
): Promise<{ success: number; failed: number; error?: string }> {
  if (documents.length === 0) {
    return { success: 0, failed: 0 };
  }

  const results: { success: number; failed: number; error?: string } = { success: 0, failed: 0 };
  const batchSize = 500; // Firestore batch limit

  // Process in batches of 500
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);

    try {
      const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents:batchWrite`;

      const writes = batch.map(doc => {
        const fields: Record<string, any> = {};
        for (const [key, value] of Object.entries(doc.data)) {
          fields[key] = toFirestoreValue(value);
        }

        return {
          update: {
            name: `projects/${config.projectId}/databases/(default)/documents/${doc.path}`,
            fields,
          },
        };
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ writes }),
      });

      if (response.ok) {
        const responseData: any = await response.json();
        // Count successes and failures from response
        const writeResults = responseData.writeResults || [];
        writeResults.forEach((result: any, index: number) => {
          if (result.updateTime) {
            results.success++;
          } else {
            results.failed++;
            console.error(`[batchSetDocuments] Failed to write: ${batch[index].path}`);
          }
        });
        // If writeResults is empty but response was OK, count all as success
        if (writeResults.length === 0) {
          results.success += batch.length;
        }
      } else {
        const errorText = await response.text();
        console.error(`[batchSetDocuments] Batch write failed: ${response.status}`, errorText);
        results.failed += batch.length;
        results.error = `HTTP ${response.status}: ${errorText.substring(0, 500)}`;
      }
    } catch (error) {
      console.error('[batchSetDocuments] Error:', error);
      results.failed += batch.length;
      results.error = `Exception: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  console.log(`[batchSetDocuments] Complete: ${results.success} success, ${results.failed} failed`);
  return results;
}
