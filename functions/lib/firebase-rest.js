/**
 * Firebase REST API Helper
 * Cloudflare Workers compatible Firebase client using REST API
 */
/**
 * Verify Firebase ID Token using Firebase Auth REST API
 */
export async function verifyIdToken(idToken, config) {
    try {
        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${config.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
        });
        if (!response.ok) {
            console.error('Token verification failed:', response.status);
            return null;
        }
        const data = await response.json();
        if (!data.users || data.users.length === 0) {
            return null;
        }
        const user = data.users[0];
        return {
            uid: user.localId,
            email: user.email,
            email_verified: user.emailVerified,
        };
    }
    catch (error) {
        console.error('Error verifying token:', error);
        return null;
    }
}
/**
 * Create a new user with email and password
 */
export async function createUser(email, password, config) {
    try {
        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${config.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            console.error('User creation failed:', errorData);
            return null;
        }
        const data = await response.json();
        return {
            uid: data.localId,
            idToken: data.idToken,
        };
    }
    catch (error) {
        console.error('Error creating user:', error);
        return null;
    }
}
/**
 * Convert JavaScript value to Firestore field value format
 */
function toFirestoreValue(value) {
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
        const fields = {};
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
function fromFirestoreValue(fieldValue) {
    if (!fieldValue)
        return null;
    if ('nullValue' in fieldValue)
        return null;
    if ('stringValue' in fieldValue)
        return fieldValue.stringValue;
    if ('integerValue' in fieldValue)
        return parseInt(fieldValue.integerValue, 10);
    if ('doubleValue' in fieldValue)
        return fieldValue.doubleValue;
    if ('booleanValue' in fieldValue)
        return fieldValue.booleanValue;
    if ('timestampValue' in fieldValue)
        return new Date(fieldValue.timestampValue);
    if ('arrayValue' in fieldValue) {
        return (fieldValue.arrayValue.values || []).map(fromFirestoreValue);
    }
    if ('mapValue' in fieldValue) {
        const obj = {};
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
export async function getDocument(path, idToken, config) {
    try {
        const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/${path}`;
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${idToken}`,
            },
        });
        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            console.error('Get document failed:', response.status);
            return null;
        }
        const doc = await response.json();
    }
    catch (error) {
        console.error('Error getting document:', error);
        return null;
    }
}
/**
 * Create a Firestore document with auto-generated ID
 */
export async function createDocument(collectionPath, data, idToken, config) {
    try {
        const fields = {};
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
        const doc = await response.json();
        const docId = doc.name.split('/').pop();
        return {
            id: docId,
            data: fromFirestoreDocument(doc),
        };
    }
    catch (error) {
        console.error('Error creating document:', error);
        return null;
    }
}
/**
 * Set a Firestore document (create or overwrite)
 */
export async function setDocument(path, data, idToken, config) {
    try {
        const fields = {};
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
        return response.ok;
    }
    catch (error) {
        console.error('Error setting document:', error);
        return false;
    }
}
/**
 * Update a Firestore document
 */
export async function updateDocument(path, data, idToken, config) {
    try {
        const fields = {};
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
    }
    catch (error) {
        console.error('Error updating document:', error);
        return false;
    }
}
/**
 * Delete a Firestore document
 */
export async function deleteDocument(path, idToken, config) {
    try {
        const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/${path}`;
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${idToken}`,
            },
        });
        return response.ok;
    }
    catch (error) {
        console.error('Error deleting document:', error);
        return false;
    }
}
/**
 * List documents in a collection
 */
export async function listDocuments(collectionPath, idToken, config, pageSize = 100) {
    try {
        const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/${collectionPath}?pageSize=${pageSize}`;
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${idToken}`,
            },
        });
        if (!response.ok) {
            console.error('List documents failed:', response.status);
            return [];
        }
        const data = await response.json();
        const documents = data.documents || [];
        return documents.map((doc) => ({
            id: doc.name.split('/').pop(),
            ...fromFirestoreDocument(doc),
        }));
    }
    catch (error) {
        console.error('Error listing documents:', error);
        return [];
    }
}
/**
 * Convert Firestore document to plain object
 */
function fromFirestoreDocument(doc) {
    const result = {};
    for (const [key, value] of Object.entries(doc.fields || {})) {
        result[key] = fromFirestoreValue(value);
    }
    return result;
}
/**
 * Run a structured query
 */
export async function runQuery(collectionPath, query, idToken, config) {
    try {
        const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents:runQuery`;
        const structuredQuery = {
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
        const results = await response.json();
        return (results || [])
            .filter((result) => result.document)
            .map((result) => ({
            id: result.document.name.split('/').pop(),
            ...fromFirestoreDocument(result.document),
        }));
    }
    catch (error) {
        console.error('Error running query:', error);
        return [];
    }
}
