import admin from "firebase-admin";

let initialized = false;

/**
 * Inicializa Firebase Admin una sola vez.
 * Acepta:
 * - FIREBASE_SERVICE_ACCOUNT_JSON (JSON string completo de la service account)
 * - o FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 */
export function getFirebaseAdmin(): typeof admin | null {
  if (initialized) {
    return admin.apps.length ? admin : null;
  }

  try {
    if (admin.apps.length > 0) {
      initialized = true;
      return admin;
    }

    const jsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    if (jsonRaw) {
      const parsed = JSON.parse(jsonRaw) as admin.ServiceAccount;
      admin.initializeApp({
        credential: admin.credential.cert(parsed),
      });
      initialized = true;
      return admin;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY?.trim();

    if (projectId && clientEmail && privateKeyRaw) {
      const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      initialized = true;
      return admin;
    }

    console.warn(
      "[firebaseAdmin] Credenciales FCM no configuradas. Define FIREBASE_SERVICE_ACCOUNT_JSON o FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY."
    );
    initialized = true;
    return null;
  } catch (error) {
    console.error("[firebaseAdmin] Error inicializando Firebase Admin:", error);
    initialized = true;
    return null;
  }
}

export function getFirebaseMessaging(): admin.messaging.Messaging | null {
  const fb = getFirebaseAdmin();
  if (!fb || !fb.apps.length) return null;
  return fb.messaging();
}
