import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = 'd:\\documents\\whatsapp ai\\Asset-Linker\\c-whatsapp-d77dc-firebase-adminsdk-fbsvc-52909d26ec.json';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath)
});

const db = admin.firestore();

async function setAiKey() {
  const userId = "pfhkobYnulfIsHt607mCt0Ms2Wq2";
  const apiKey = "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";
  
  await db.collection("ai_settings").doc(userId).set({
    userId,
    provider: "openrouter",
    apiKey: apiKey,
    model: "openai/gpt-4o-mini",
    autoReply: true,
    temperature: 7,
    maxTokens: 500,
    updatedAt: new Date()
  }, { merge: true });

  await db.collection("whatsapp_sessions").doc(userId).set({
    automationEnabled: true,
    updatedAt: new Date()
  }, { merge: true });

  console.log("SUCCESS: OpenRouter API key and Automation enabled for user pfhkobY");
  process.exit(0);
}

setAiKey().catch(err => {
  console.error(err);
  process.exit(1);
});
