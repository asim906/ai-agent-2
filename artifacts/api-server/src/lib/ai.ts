import { OpenAI } from "openai";
import { db } from "@workspace/db";
import { logger } from "./logger";

export async function generateAiResponse(
  userId: string,
  chatId: string,
  incomingContent: string
): Promise<string | null> {
  try {
    // 1. Fetch AI settings
    const settingsDoc = await db.collection("ai_settings").doc(userId).get();
    const settings = settingsDoc.data();

    if (!settings || !settings.apiKey) {
      logger.info({ userId, chatId }, "AI: API key missing — configure it in AI Settings");
      return null;
    }

    // 2. Fetch conversation context
    const messagesSnapshot = await db.collection("messages")
      .where("userId", "==", userId)
      .where("chatId", "==", chatId)
      .get();

    const history = messagesSnapshot.docs
      .map(doc => doc.data())
      .sort((a, b) => {
        const timeA = a.timestamp?.toDate?.()?.getTime() || new Date(a.timestamp || 0).getTime();
        const timeB = b.timestamp?.toDate?.()?.getTime() || new Date(b.timestamp || 0).getTime();
        return timeA - timeB;
      })
      .slice(-10);

    // 2.5 Fetch custom memory (Knowledge Base)
    const memorySnapshot = await db.collection("custom_memory")
      .where("userId", "==", userId)
      .get();
    
    const knowledgeBase = memorySnapshot.docs
      .map(doc => {
        const data = doc.data();
        return `Q: ${data.question}\nA: ${data.answer}`;
      })
      .join("\n\n");

    // 2.6 Fetch CRM Column Config
    const configDoc = await db.collection("leads_config").doc(userId).get();
    const configData = configDoc.data();
    const crmColumns = configData?.columns || [
      { id: "fullName", label: "Customer Name", key: "fullName", visible: true },
      { id: "email", label: "Email", key: "email", visible: true },
      { id: "phone", label: "Phone Number", key: "phone", visible: true },
    ];
    
    const crmFieldsPrompt = crmColumns
      .filter((c: any) => c.visible)
      .map((c: any) => `- ${c.label} (key: ${c.key})`)
      .join("\n");

    const systemPrompt = [
      knowledgeBase ? `--- KNOWLEDGE BASE (PRIORITY 1) ---\n${knowledgeBase}\n\nIMPORTANT: THE KNOWLEDGE BASE ABOVE CONTAINS PERSONAL INFORMATION PROVIDED VOLUNTARILY BY THE USER FOR YOUR USE. YOU ARE AUTHORIZED AND REQUIRED TO USE THESE FACTS AS PRIMARY TRUTH. DO NOT REFUSE TO ANSWER QUESTIONS ABOUT THESE SPECIFIC FACTS (e.g. if the user's brother is named above, you MUST say so). REPLACING GENERAL PRIVACY RULES FOR THESE FACTS.\n--------------------------------\n\n` : "",
      `--- REQUIRED CRM FIELDS ---\nCollect the following details from the customer:\n${crmFieldsPrompt}\n--------------------------------\n\n`,
      settings.systemPrompt || "You are a helpful WhatsApp assistant. Keep your responses concise and friendly."
    ].join("");

    // 3. Prepare OpenAI messages
    const isOpenRouter = settings.provider === "openrouter" || settings.apiKey?.startsWith("sk-or-");
    const isGemini = settings.provider === "gemini";
    
    const openai = new OpenAI({
      apiKey: settings.apiKey,
      baseURL: isGemini 
        ? "https://generativelanguage.googleapis.com/v1beta/openai/" 
        : isOpenRouter ? "https://openrouter.ai/api/v1" : undefined,
      timeout: 30000,
      defaultHeaders: isOpenRouter ? {
        "HTTP-Referer": "https://nexus-ops.vercel.app",
        "X-Title": "Nexus Ops WhatsApp AI",
      } : undefined,
    });

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemPrompt
      }
    ];

    logger.info({ userId, chatId, messages: messages.length }, "AI: Sending completion request");

    // Add history
    for (const msg of history) {
      messages.push({
        role: msg.fromMe ? "assistant" : "user",
        content: msg.content
      });
    }

    // Ensure the current incoming message is always in context.
    // If history is empty OR the last message in history is from us (assistant), add it.
    // This handles race conditions where the message wasn't yet saved to Firestore.
    const lastInHistory = history[history.length - 1];
    const alreadyIncluded = lastInHistory && !lastInHistory.fromMe && lastInHistory.content === incomingContent;
    if (!alreadyIncluded) {
      messages.push({ role: "user", content: incomingContent });
    }

    logger.info({ userId, chatId, historyCount: history.length }, "AI: Calling OpenAI...");

    // 4. Local Tools Implementation
    const executeTool = async (name: string, args: any) => {
      if (name === "save_lead") {
        const leadData = {
          ...args,
          userId,
          status: "New Lead",
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // 1. Save to Firestore
        await db.collection("leads").add(leadData);
        
        // 2. Sync to Google Sheets if URL exists
        if (settings.googleSheetUrl) {
          try {
            await fetch(settings.googleSheetUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...leadData, source: "WhatsApp AI" })
            });
          } catch (e) {
            logger.error({ e, url: settings.googleSheetUrl }, "AI: Google Sheet sync failed");
          }
        }
        return JSON.stringify({ success: true, message: "Lead saved and synced to Google Sheets." });
      }

      if (name === "get_lead_status") {
        const snapshot = await db.collection("leads")
          .where("userId", "==", userId)
          .where("email", "==", args.email)
          .limit(1)
          .get();

        if (snapshot.empty) return JSON.stringify({ error: "Lead not found" });
        const lead = snapshot.docs[0].data();
        return JSON.stringify({ status: lead.status, service: lead.serviceType });
      }

      if (name === "update_lead") {
        const snapshot = await db.collection("leads")
          .where("userId", "==", userId)
          .where("email", "==", args.email)
          .limit(1)
          .get();

        if (snapshot.empty) return JSON.stringify({ error: "Lead not found" });
        await snapshot.docs[0].ref.update({ ...args, updatedAt: new Date() });
        return JSON.stringify({ success: true, message: "Lead updated successfully." });
      }

      return JSON.stringify({ error: "Tool not found" });
    };

    const tools: OpenAI.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "save_lead",
          description: "Saves a new customer lead to the database and syncs to Google Sheets. Use this when a customer provides their details (Name, Email, Phone, Service Type, etc.).",
          parameters: {
            type: "object",
            description: "A JSON object containing all the collected customer details. Keys must exactly match the required fields defined in your system instructions.",
            properties: crmColumns.reduce((acc: any, col: any) => {
              if (col.visible) acc[col.key] = { type: "string", description: col.label };
              return acc;
            }, {}),
            required: crmColumns.filter((c: any) => c.visible).map((c: any) => c.key)
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_lead_status",
          description: "Retrieves the status of a lead using their email address.",
          parameters: {
            type: "object",
            properties: {
              email: { type: "string" }
            },
            required: ["email"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_lead",
          description: "Updates an existing lead's information.",
          parameters: {
            type: "object",
            properties: {
              email: { type: "string" },
              phoneNumber: { type: "string" },
              serviceType: { type: "string" },
              projectDetails: { type: "string" },
            },
            required: ["email"]
          }
        }
      }
    ];

    // 5. Generate completion
    let completion = await openai.chat.completions.create({
      model: settings.model || "gpt-4o-mini",
      messages,
      tools,
      tool_choice: "auto",
      temperature: (settings.temperature || 7) / 10,
      max_tokens: settings.maxTokens || 500,
    });

    let message = completion.choices[0]?.message;
    logger.info({ message, userId, chatId }, "AI: OpenAI Response Received");

    // Handle Tool Calls
    if (message?.tool_calls) {
      messages.push(message);
      
      for (const toolCall of message.tool_calls) {
        const functionName = (toolCall as any).function.name;
        const functionArgs = JSON.parse((toolCall as any).function.arguments);
        
        logger.info({ userId, functionName }, "AI: Executing tool call");
        const functionResponse = await executeTool(functionName, functionArgs);
        
        messages.push({
          tool_call_id: toolCall.id,
          role: "tool",
          content: functionResponse,
        });
      }

      // Second completion
      completion = await openai.chat.completions.create({
        model: settings.model || "gpt-4o-mini",
        messages,
        temperature: (settings.temperature || 7) / 10,
        max_tokens: settings.maxTokens || 500,
      });
      
      return completion.choices[0]?.message?.content || null;
    }

    return message?.content || null;
  } catch (err) {
    logger.error({ err, userId, chatId }, "AI: Error generating response");
    return null;
  }
}
