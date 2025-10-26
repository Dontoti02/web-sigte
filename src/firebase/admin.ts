
import * as admin from 'firebase-admin';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

async function initializeAdminApp() {
  if (admin.apps.length > 0) {
    return { app: admin.app() };
  }

  let credentials;
  try {
    const GOOGLE_APPLICATION_CREDENTIALS =
      process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (GOOGLE_APPLICATION_CREDENTIALS) {
      credentials = JSON.parse(GOOGLE_APPLICATION_CREDENTIALS);
    }
  } catch (e) {
    console.error(
      'Could not parse GOOGLE_APPLICATION_CREDENTIALS. Using default credentials.'
    );
  }

  const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || "sigte-ebf49";

  try {
    const app = admin.initializeApp({
      credential: credentials
        ? admin.credential.cert(credentials)
        : admin.credential.applicationDefault(),
      projectId: projectId,
    });
    return { app };
  } catch (e) {
    console.error('Could not initialize Firebase Admin SDK.', e);
    throw e;
  }
}

export { initializeAdminApp };
