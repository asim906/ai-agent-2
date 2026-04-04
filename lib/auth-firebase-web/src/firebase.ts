import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY || "AIzaSyDjjE6JovD14x5b5HLjq74dYdtDTtOXOvI",
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN || "whatsapp-ai-e0b6e.firebaseapp.com",
  databaseURL: (import.meta as any).env.VITE_FIREBASE_DATABASE_URL || "",
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID || "whatsapp-ai-e0b6e",
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET || "whatsapp-ai-e0b6e.firebasestorage.app",
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID || "189714050734",
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID || "1:189714050734:web:b1a4a5afb542f4e343473f"
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
