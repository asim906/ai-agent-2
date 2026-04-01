import { Router } from "express";
import { db } from "@workspace/db";
import { messagesTable, chatsTable } from "@workspace/db/schema";
import {
  GetAnalyticsSummaryResponse,
  GetDailyAnalyticsResponse,
} from "@workspace/api-zod";
import { eq, and, count, sql } from "drizzle-orm";

const router = Router();

router.get("/analytics/summary", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [{ totalMessages }] = await db
      .select({ totalMessages: count() })
      .from(messagesTable)
      .where(eq(messagesTable.userId, req.user.id));

    const [{ totalSent }] = await db
      .select({ totalSent: count() })
      .from(messagesTable)
      .where(and(eq(messagesTable.userId, req.user.id), eq(messagesTable.fromMe, true)));

    const [{ aiResponses }] = await db
      .select({ aiResponses: count() })
      .from(messagesTable)
      .where(and(eq(messagesTable.userId, req.user.id), eq(messagesTable.isAiGenerated, true)));

    const [{ totalChats }] = await db
      .select({ totalChats: count() })
      .from(chatsTable)
      .where(eq(chatsTable.userId, req.user.id));

    const totalMessages_ = totalMessages ?? 0;
    const totalSent_ = totalSent ?? 0;
    const aiResponses_ = aiResponses ?? 0;

    const result = GetAnalyticsSummaryResponse.parse({
      totalMessages: totalMessages_,
      totalSent: totalSent_,
      totalReceived: totalMessages_ - totalSent_,
      totalChats: totalChats ?? 0,
      aiResponses: aiResponses_,
      successRate: totalMessages_ > 0 ? Math.round((aiResponses_ / totalMessages_) * 100) : 0,
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

    const dailyData = await db
      .select({
        date: sql<string>`DATE(${messagesTable.timestamp})`.as("date"),
        sent: sql<number>`COUNT(*) FILTER (WHERE ${messagesTable.fromMe} = true)`.as("sent"),
        received: sql<number>`COUNT(*) FILTER (WHERE ${messagesTable.fromMe} = false)`.as("received"),
        aiResponses: sql<number>`COUNT(*) FILTER (WHERE ${messagesTable.isAiGenerated} = true)`.as("ai_responses"),
      })
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.userId, req.user.id),
          sql`${messagesTable.timestamp} >= ${thirtyDaysAgo}`
        )
      )
      .groupBy(sql`DATE(${messagesTable.timestamp})`)
      .orderBy(sql`DATE(${messagesTable.timestamp})`);

    const days: Array<{ date: string; sent: number; received: number; aiResponses: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const found = dailyData.find((r) => r.date === dateStr);
      days.push({
        date: dateStr,
        sent: Number(found?.sent ?? 0),
        received: Number(found?.received ?? 0),
        aiResponses: Number(found?.aiResponses ?? 0),
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
