import { initializeApp, cert, getApps, ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { generateKeyPairSync } from "crypto";

console.log("🔥 firebase.ts loaded");

let serviceAccount: any = null;
try {
  serviceAccount = require("./firebase/serviceAccountKey.json");
} catch (error) {
  try {
    serviceAccount = require("./firebase/serviceAccountkey.json");
  } catch (keyError) {
    console.warn("⚠️ Firebase serviceAccountKey.json is missing. Using dummy credentials for offline mock testing.");
    
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 1024,
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });

    serviceAccount = {
      projectId: "mock-project-id",
      clientEmail: "mock-client-email@mock.iam.gserviceaccount.com",
      privateKey: privateKey,
    };
  }
}

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount as ServiceAccount),
  });

  console.log("✅ Firebase Initialized");
}

export const auth = getAuth();