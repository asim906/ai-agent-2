import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let app: App = null as unknown as App;

if (getApps().length === 0) {
  // In production, use SERVICE_ACCOUNT_JSON env var
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : undefined;

  console.log("Firebase Init: serviceAccount exists?", !!serviceAccount);
  if (serviceAccount) {
    try {
      app = initializeApp({
        credential: cert(serviceAccount),
      });
      console.log("Firebase Init: Success with serviceAccount");
    } catch (e: any) {
      console.error("Firebase Init: Error with serviceAccount", e.message);
      console.error("Please ensure FIREBASE_SERVICE_ACCOUNT contains valid Firebase service account JSON");
      throw e;
    }
  } else {
    // For development, try to find the service account file in common locations
    const possiblePaths = [
      path.join(process.cwd(), "c-whatsapp-d77dc-firebase-adminsdk-fbsvc-52909d26ec.json"),
      path.join(__dirname, "../../../c-whatsapp-d77dc-firebase-adminsdk-fbsvc-52909d26ec.json"),
      "c-whatsapp-d77dc-firebase-adminsdk-fbsvc-52909d26ec.json"
    ];

    let foundFile = false;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        try {
          console.log(`Firebase Init: Found service account file at ${p}`);
          const content = JSON.parse(fs.readFileSync(p, "utf-8"));
          app = initializeApp({
            credential: cert(content),
            projectId: content.project_id
          });
          foundFile = true;
          console.log("Firebase Init: Success with service account file");
          break;
        } catch (e: any) {
          console.warn(`Firebase Init: Failed to read service account from ${p}:`, e.message);
        }
      }
    }

    if (!foundFile) {
      // For development, try to use Application Default Credentials
      try {
        console.log("Firebase Init: Attempting to use Application Default Credentials");
        console.log("Make sure GOOGLE_APPLICATION_CREDENTIALS is set or Firebase CLI is logged in");
        app = initializeApp({
          projectId: "whatsapp-ai-e0b6e"
        });
        console.log("Firebase Init: Success with Application Default Credentials");
      } catch (e: any) {
        console.error("Firebase Init: Error with Application Default Credentials", e.message);
        console.error("");
        console.error("To fix this, you have several options:");
        console.error("1. Set FIREBASE_SERVICE_ACCOUNT environment variable with your service account JSON");
        console.error("2. Set GOOGLE_APPLICATION_CREDENTIALS to point to your service account key file");
        console.error("3. Run 'firebase login' if using Firebase CLI");
        console.error("4. For local development, download a service account key from Firebase Console");
        console.error("");
        throw new Error(`Firebase initialization failed: ${e.message}`);
      }
    }
  }
} else {
  console.log("Firebase Init: Using existing app");
  app = getApps()[0];
}

export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);

// Export a dummy schema object to avoid breaking existing imports that use it for types
export const schema = {};
