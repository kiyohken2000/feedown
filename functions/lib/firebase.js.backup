/**
 * Firebase Admin SDK Initialization
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
let adminApp = null;
/**
 * Initialize Firebase Admin SDK
 * Uses environment variables for configuration
 */
export function initializeFirebaseAdmin(env) {
    // Return existing app if already initialized
    if (adminApp) {
        return adminApp;
    }
    // Check if already initialized by another instance
    const existingApps = getApps();
    if (existingApps.length > 0) {
        adminApp = existingApps[0];
        return adminApp;
    }
    // Initialize with service account from environment
    const serviceAccount = {
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };
    adminApp = initializeApp({
        credential: cert(serviceAccount),
    });
    return adminApp;
}
/**
 * Get Firebase Auth instance
 */
export function getAdminAuth(env) {
    const app = initializeFirebaseAdmin(env);
    return getAuth(app);
}
/**
 * Get Firestore instance
 */
export function getAdminFirestore(env) {
    const app = initializeFirebaseAdmin(env);
    return getFirestore(app);
}
