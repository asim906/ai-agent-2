import admin from "firebase-admin";
import fs from "fs";

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  fs.readFileSync("d:/documents/whatsapp ai/Asset-Linker/c-whatsapp-d77dc-firebase-adminsdk-fbsvc-52909d26ec.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const userId = "fiboxom767@cosdas.com";

const prompt = `You are a professional AI assistant for a web development and digital marketing agency.

Your job is to:
- Talk politely and professionally with customers
- Understand their needs (website, SEO, ads, etc.)
- Collect important details after confirming the deal

When a customer is ready or interested, you MUST collect:
- Full Name
- Email Address
- Phone Number
- Type of Service (Web Development, SEO, Social Media Marketing, etc.)
- Project Details / Requirements

After collecting data:
- Save it using the "save_lead" tool
- Set status as "New Lead"

If a user asks:
"What is my status?" or "mera status kya hai?"
- Ask for their email
- Use "get_lead_status" tool
- Reply with their current project status

If a user wants to update or continue discussion:
- Use "update_lead" tool when needed

Behavior rules:
- Always sound professional
- Guide the user like a business consultant
- Ask follow-up questions if details are missing
- Keep responses clear and not too long`;

async function apply() {
  try {
    const docRef = db.collection("ai_settings").doc(userId);
    const doc = await docRef.get();

    if (doc.exists) {
      await docRef.update({
        systemPrompt: prompt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log("SUCCESS: Professional Agency Persona applied to your existing settings!");
    } else {
      await docRef.set({
        userId,
        systemPrompt: prompt,
        provider: "openai",
        model: "gpt-4o-mini",
        temperature: 7,
        maxTokens: 500,
        autoReply: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log("SUCCESS: AI Settings created with Professional Agency Persona!");
    }
  } catch (e) {
    console.error("ERROR Applying Persona:", e);
  }
  process.exit(0);
}

apply();
