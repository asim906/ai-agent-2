import { Router } from "express";
import { db } from "@workspace/db";
import { chatsTable, messagesTable } from "@workspace/db/schema";
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
} from "@workspace/api-zod";
import { eq, and, desc, asc } from "drizzle-orm";
import { nanoid } from "nanoid";

const router = Router();

router.get("/chats", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const chats = await db.query.chatsTable.findMany({
      where: eq(chatsTable.userId, req.user.id),
      orderBy: [desc(chatsTable.lastMessageAt)],
    });

    const result = ListChatsResponse.parse(
      chats.map((c) => ({
        id: c.id,
        name: c.name,
        phoneNumber: c.phoneNumber || null,
        profilePicUrl: c.profilePicUrl || null,
        lastMessage: c.lastMessage || null,
        lastMessageAt: c.lastMessageAt?.toISOString() || null,
        unreadCount: c.unreadCount,
        isGroup: c.isGroup,
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
    const chat = await db.query.chatsTable.findFirst({
      where: and(
        eq(chatsTable.id, params.data.chatId),
        eq(chatsTable.userId, req.user.id)
      ),
    });

    if (!chat) {
      res.status(404).json({ error: "Chat not found" });
      return;
    }

    const result = GetChatResponse.parse({
      id: chat.id,
      name: chat.name,
      phoneNumber: chat.phoneNumber || null,
      profilePicUrl: chat.profilePicUrl || null,
      lastMessage: chat.lastMessage || null,
      lastMessageAt: chat.lastMessageAt?.toISOString() || null,
      unreadCount: chat.unreadCount,
      isGroup: chat.isGroup,
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
    const messages = await db.query.messagesTable.findMany({
      where: and(
        eq(messagesTable.chatId, params.data.chatId),
        eq(messagesTable.userId, req.user.id)
      ),
      orderBy: [asc(messagesTable.timestamp)],
      limit: query.data.limit ?? 50,
      offset: query.data.offset ?? 0,
    });

    const result = ListMessagesResponse.parse(
      messages.map((m) => ({
        id: m.id,
        chatId: m.chatId,
        content: m.content,
        fromMe: m.fromMe,
        timestamp: m.timestamp.toISOString(),
        type: m.type as "text" | "image" | "document" | "audio" | "video",
        isAiGenerated: m.isAiGenerated,
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
    const chat = await db.query.chatsTable.findFirst({
      where: and(
        eq(chatsTable.id, params.data.chatId),
        eq(chatsTable.userId, req.user.id)
      ),
    });

    if (!chat) {
      res.status(404).json({ error: "Chat not found" });
      return;
    }

    const id = nanoid();
    const now = new Date();

    await db.insert(messagesTable).values({
      id,
      chatId: params.data.chatId,
      userId: req.user.id,
      content: body.data.content,
      fromMe: true,
      timestamp: now,
      type: "text",
      isAiGenerated: false,
    });

    await db
      .update(chatsTable)
      .set({ lastMessage: body.data.content, lastMessageAt: now })
      .where(eq(chatsTable.id, params.data.chatId));

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

export default router;
