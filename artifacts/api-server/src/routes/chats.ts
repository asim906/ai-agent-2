import { Router } from "express";
import { db } from "@workspace/db";
import {
  ListChatsResponse,
  GetChatParams,
  GetChatResponse,
  ListMessagesParams,
  ListMessagesQueryParams,
  ListMessagesResponse,
  SendMessageParams,
  SendMessageBody,
  SendMessageResponse,
  UpdateChatAutomationBody,
  UpdateChatAutomationResponse,
} from "@workspace/api-zod";
import { nanoid } from "nanoid";
import { whatsappService } from "../lib/whatsapp";

const router = Router();
const CHATS_COLLECTION = "chats";
const MESSAGES_COLLECTION = "messages";

router.get("/chats", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const snapshot = await db.collection(CHATS_COLLECTION)
      .where("userId", "==", req.user.id)
      .get();

    const chats = snapshot.docs
      .map(doc => {
        const data = doc.data() as any;
        const fullId = doc.id;
        const rawJid = fullId.includes("_") ? fullId.split("_").slice(1).join("_") : fullId;
        return { 
          id: rawJid, 
          ...data,
          name: data.name || data.phoneNumber || rawJid.split("@")[0] || "Unknown",
          automationEnabled: data.automationEnabled !== false, // Default to true
        };
      })
      .sort((a: any, b: any) => {
        const dateA = a.lastMessageAt?.toDate?.() || new Date(a.lastMessageAt || 0);
        const dateB = b.lastMessageAt?.toDate?.() || new Date(b.lastMessageAt || 0);
        return dateB.getTime() - dateA.getTime();
      });

    const result = ListChatsResponse.parse(
      chats.map((c: any) => ({
        id: c.id,
        name: c.name,
        phoneNumber: c.phoneNumber || null,
        profilePicUrl: c.profilePicUrl || null,
        lastMessage: c.lastMessage || null,
        lastMessageAt: c.lastMessageAt?.toDate?.()?.toISOString() || c.lastMessageAt || null,
        unreadCount: c.unreadCount || 0,
        isGroup: c.isGroup || false,
        automationEnabled: c.automationEnabled !== false,
      }))
    );
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error listing chats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/chats/:chatId", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = GetChatParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  try {
    const prefixedChatId = `${req.user.id}_${params.data.chatId}`;
    const doc = await db.collection(CHATS_COLLECTION).doc(prefixedChatId).get();
    const chat = doc.data();

    if (!doc.exists || chat?.userId !== req.user.id) {
      res.status(404).json({ error: "Chat not found" });
      return;
    }

    const result = GetChatResponse.parse({
      id: doc.id,
      name: chat.name || chat.phoneNumber || chat.id?.split("@")[0] || "Unknown",
      phoneNumber: chat.phoneNumber || null,
      profilePicUrl: chat.profilePicUrl || null,
      lastMessage: chat.lastMessage || null,
      lastMessageAt: chat.lastMessageAt?.toDate?.()?.toISOString() || chat.lastMessageAt || null,
      unreadCount: chat.unreadCount || 0,
      isGroup: chat.isGroup || false,
      automationEnabled: chat.automationEnabled !== false, // Default to true
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting chat");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/chats/:chatId/messages", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = ListMessagesParams.safeParse(req.params);
  const query = ListMessagesQueryParams.safeParse(req.query);

  if (!params.success || !query.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  try {
    const prefixedChatId = `${req.user.id}_${params.data.chatId}`;
    const snapshot = await db.collection(MESSAGES_COLLECTION)
      .where("chatId", "==", params.data.chatId)
      .where("userId", "==", req.user.id)
      .get();

    const messages = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => {
        const timeA = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
        const timeB = b.timestamp?.toDate?.() || new Date(b.timestamp || 0);
        return timeA.getTime() - timeB.getTime();
      });

    const result = ListMessagesResponse.parse(
      messages.map((m: any) => ({
        id: m.id,
        chatId: m.chatId,
        content: m.content,
        fromMe: m.fromMe,
        timestamp: m.timestamp?.toDate?.()?.toISOString() || m.timestamp || new Date().toISOString(),
        type: (m.type || "text") as "text" | "image" | "document" | "audio" | "video",
        isAiGenerated: m.isAiGenerated || false,
        senderName: m.senderName || null,
      }))
    );
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error listing messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/chats/:chatId/send", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = SendMessageParams.safeParse(req.params);
  const body = SendMessageBody.safeParse(req.body);

  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  try {
    const prefixedChatId = `${req.user.id}_${params.data.chatId}`;
    const chatRef = db.collection(CHATS_COLLECTION).doc(prefixedChatId);
    const doc = await chatRef.get();
    const chat = doc.data();

    if (!doc.exists || chat?.userId !== req.user.id) {
      res.status(404).json({ error: "Chat not found" });
      return;
    }

    const id = nanoid();
    const now = new Date();

    // Send the message via WhatsApp socket
    await whatsappService.sendMessage(req.user.id, params.data.chatId, body.data.content);

    await db.collection(MESSAGES_COLLECTION).doc(`${req.user.id}_${id}`).set({
      chatId: params.data.chatId,
      userId: req.user.id,
      content: body.data.content,
      fromMe: true,
      timestamp: now,
      type: "text",
      isAiGenerated: false,
    });

    await chatRef.update({
      lastMessage: body.data.content,
      lastMessageAt: now,
    });

    const result = SendMessageResponse.parse({
      id,
      chatId: params.data.chatId,
      content: body.data.content,
      fromMe: true,
      timestamp: now.toISOString(),
      type: "text",
      isAiGenerated: false,
      senderName: null,
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error sending message");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/chats/:chatId/automation", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const params = GetChatParams.safeParse(req.params);
  const body = UpdateChatAutomationBody.safeParse(req.body);

  if (!params.success || !body.success) {
    return res.status(400).json({ error: "Invalid request" });
  }

  try {
    const prefixedChatId = `${req.user.id}_${params.data.chatId}`;
    await db.collection(CHATS_COLLECTION).doc(prefixedChatId).set({
      automationEnabled: body.data.enabled,
      updatedAt: new Date(),
    }, { merge: true });

    res.json({ success: true, enabled: body.data.enabled });
  } catch (err) {
    req.log.error({ err }, "Error updating chat automation");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
