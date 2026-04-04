import { Router } from "express";
import { db } from "@workspace/db";
import {
  GetAnalyticsSummaryResponse,
  GetDailyAnalyticsResponse,
} from "@workspace/api-zod";

const router = Router();
const MESSAGES_COLLECTION = "messages";
const CHATS_COLLECTION = "chats";

router.get("/analytics/summary", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const totalMessagesSnapshot = await db.collection(MESSAGES_COLLECTION)
      .where("userId", "==", req.user.id)
      .count()
      .get();
    const totalMessages = totalMessagesSnapshot.data().count;

    const totalSentSnapshot = await db.collection(MESSAGES_COLLECTION)
      .where("userId", "==", req.user.id)
      .where("fromMe", "==", true)
      .count()
      .get();
    const totalSent = totalSentSnapshot.data().count;

    const aiResponsesSnapshot = await db.collection(MESSAGES_COLLECTION)
      .where("userId", "==", req.user.id)
      .where("isAiGenerated", "==", true)
      .count()
      .get();
    const aiResponses = aiResponsesSnapshot.data().count;

    const totalChatsSnapshot = await db.collection(CHATS_COLLECTION)
      .where("userId", "==", req.user.id)
      .count()
      .get();
    const totalChats = totalChatsSnapshot.data().count;

    const result = GetAnalyticsSummaryResponse.parse({
      totalMessages,
      totalSent,
      totalReceived: totalMessages - totalSent,
      totalChats,
      aiResponses,
      successRate: totalMessages > 0 ? Math.round((aiResponses / totalMessages) * 100) : 0,
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting analytics summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics/daily", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const snapshot = await db.collection(MESSAGES_COLLECTION)
      .where("userId", "==", req.user.id)
      .where("timestamp", ">=", thirtyDaysAgo)
      .get();

    const messages = snapshot.docs
      .map(doc => doc.data() as any)
      .sort((a, b) => {
        const timeA = a.timestamp?.toDate?.()?.getTime() || new Date(a.timestamp || 0).getTime();
        const timeB = b.timestamp?.toDate?.()?.getTime() || new Date(b.timestamp || 0).getTime();
        return timeA - timeB;
      });
    const dailyMap = new Map<string, { sent: number; received: number; aiResponses: number }>();

    messages.forEach(m => {
      const date = m.timestamp?.toDate?.()?.toISOString().split("T")[0] || 
                   (typeof m.timestamp === "string" ? m.timestamp.split("T")[0] : new Date().toISOString().split("T")[0]);
      
      const stats = dailyMap.get(date) || { sent: 0, received: 0, aiResponses: 0 };
      if (m.fromMe) stats.sent++;
      else stats.received++;
      if (m.isAiGenerated) stats.aiResponses++;
      dailyMap.set(date, stats);
    });

    const days: Array<{ date: string; sent: number; received: number; aiResponses: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const stats = dailyMap.get(dateStr) || { sent: 0, received: 0, aiResponses: 0 };
      days.push({
        date: dateStr,
        sent: stats.sent,
        received: stats.received,
        aiResponses: stats.aiResponses,
      });
    }

    const result = GetDailyAnalyticsResponse.parse(days);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting daily analytics");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
