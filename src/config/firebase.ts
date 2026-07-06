import { initializeApp, cert, getApps, ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

console.log("🔥 firebase.ts loaded");

let serviceAccount: any = null;
try {
  serviceAccount = require("./firebase/serviceAccountKey.json");
} catch (error) {
  console.warn("⚠️ Firebase serviceAccountKey.json is missing. Using dummy credentials for offline mock testing.");
  serviceAccount = {
    projectId: "mock-project-id",
    clientEmail: "mock-client-email@mock.iam.gserviceaccount.com",
    privateKey: "-----BEGIN PRIVATE KEY-----\nMOCK_KEY\n-----END PRIVATE KEY-----\n",
  };
}

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount as ServiceAccount),
  });

  console.log("✅ Firebase Initialized");
}

export const auth = getAuth();