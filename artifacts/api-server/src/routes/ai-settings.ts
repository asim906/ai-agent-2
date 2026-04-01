import { Router } from "express";
import { db } from "@workspace/db";
import { aiSettingsTable } from "@workspace/db/schema";
import {
  GetAiSettingsResponse,
  UpdateAiSettingsBody,
  UpdateAiSettingsResponse,
} from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/ai-settings", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    let settings = await db.query.aiSettingsTable.findFirst({
      where: eq(aiSettingsTable.userId, req.user.id),
    });

    if (!settings) {
      const [created] = await db.insert(aiSettingsTable).values({
        id: req.user.id,
        userId: req.user.id,
        provider: "openai",
        model: "gpt-4o-mini",
        temperature: 7,
        maxTokens: 500,
        autoReply: false,
      }).returning();
      settings = created;
    }

    const result = GetAiSettingsResponse.parse({
      provider: settings.provider as "openai" | "openrouter" | "gemini",
      model: settings.model,
      apiKey: settings.apiKey ? "***" + settings.apiKey.slice(-4) : null,
      temperature: settings.temperature / 10,
      maxTokens: settings.maxTokens,
      autoReply: settings.autoReply,
      systemPrompt: settings.systemPrompt || null,
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting AI settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/ai-settings", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = UpdateAiSettingsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  try {
    const existing = await db.query.aiSettingsTable.findFirst({
      where: eq(aiSettingsTable.userId, req.user.id),
    });

    const updateData: Partial<typeof aiSettingsTable.$inferInsert> = {};
    if (body.data.provider !== undefined) updateData.provider = body.data.provider;
    if (body.data.model !== undefined) updateData.model = body.data.model;
    if (body.data.apiKey !== undefined && body.data.apiKey !== null && !body.data.apiKey.startsWith("***")) {
      updateData.apiKey = body.data.apiKey;
    }
    if (body.data.temperature !== undefined) updateData.temperature = Math.round(body.data.temperature * 10);
    if (body.data.maxTokens !== undefined) updateData.maxTokens = body.data.maxTokens;
    if (body.data.autoReply !== undefined) updateData.autoReply = body.data.autoReply;
    if (body.data.systemPrompt !== undefined) updateData.systemPrompt = body.data.systemPrompt;

    let settings;
    if (existing) {
      const [updated] = await db
        .update(aiSettingsTable)
        .set(updateData)
        .where(eq(aiSettingsTable.userId, req.user.id))
        .returning();
      settings = updated;
    } else {
      const [created] = await db.insert(aiSettingsTable).values({
        id: req.user.id,
        userId: req.user.id,
        provider: body.data.provider || "openai",
        model: body.data.model || "gpt-4o-mini",
        temperature: Math.round((body.data.temperature || 0.7) * 10),
        maxTokens: body.data.maxTokens || 500,
        autoReply: body.data.autoReply || false,
        ...updateData,
      }).returning();
      settings = created;
    }

    const result = UpdateAiSettingsResponse.parse({
      provider: settings.provider as "openai" | "openrouter" | "gemini",
      model: settings.model,
      apiKey: settings.apiKey ? "***" + settings.apiKey.slice(-4) : null,
      temperature: settings.temperature / 10,
      maxTokens: settings.maxTokens,
      autoReply: settings.autoReply,
      systemPrompt: settings.systemPrompt || null,
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error updating AI settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
