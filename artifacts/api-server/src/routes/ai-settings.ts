import { Router } from "express";
import { db } from "@workspace/db";
import {
  GetAiSettingsResponse,
  UpdateAiSettingsBody,
  UpdateAiSettingsResponse,
} from "@workspace/api-zod";

const router = Router();
const COLLECTION = "ai_settings";

router.get("/ai-settings", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const docRef = db.collection(COLLECTION).doc(req.user.id);
    const doc = await docRef.get();
    let settings = doc.data();

    if (!doc.exists) {
      const defaultSettings = {
        userId: req.user.id,
        provider: "openai",
        model: "gpt-4o-mini",
        temperature: 7,
        maxTokens: 500,
        autoReply: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await docRef.set(defaultSettings);
      settings = defaultSettings;
    }

    const result = GetAiSettingsResponse.parse({
      provider: settings!.provider as "openai" | "openrouter" | "gemini",
      model: settings!.model,
      apiKey: settings!.apiKey ? "***" + settings!.apiKey.slice(-4) : null,
      temperature: settings!.temperature / 10,
      maxTokens: settings!.maxTokens,
      autoReply: settings!.autoReply,
      systemPrompt: settings!.systemPrompt || null,
      googleSheetUrl: settings!.googleSheetUrl || null,
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
    const docRef = db.collection(COLLECTION).doc(req.user.id);
    const doc = await docRef.get();

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (body.data.provider !== undefined) updateData.provider = body.data.provider;
    if (body.data.model !== undefined) updateData.model = body.data.model;
    if (body.data.apiKey !== undefined && body.data.apiKey !== null && !body.data.apiKey.startsWith("***")) {
      updateData.apiKey = body.data.apiKey;
    }
    if (body.data.temperature !== undefined) updateData.temperature = Math.round(body.data.temperature * 10);
    if (body.data.maxTokens !== undefined) updateData.maxTokens = body.data.maxTokens;
    if (body.data.autoReply !== undefined) updateData.autoReply = body.data.autoReply;
    if (body.data.systemPrompt !== undefined) updateData.systemPrompt = body.data.systemPrompt;
    if (body.data.googleSheetUrl !== undefined) updateData.googleSheetUrl = body.data.googleSheetUrl;

    let settings;
    if (doc.exists) {
      await docRef.update(updateData);
      const updatedDoc = await docRef.get();
      settings = updatedDoc.data();
    } else {
      const newData = {
        userId: req.user.id,
        provider: body.data.provider || "openai",
        model: body.data.model || "gpt-4o-mini",
        temperature: Math.round((body.data.temperature || 0.7) * 10),
        maxTokens: body.data.maxTokens || 500,
        autoReply: body.data.autoReply || false,
        createdAt: new Date(),
        ...updateData,
      };
      await docRef.set(newData);
      settings = newData;
    }

    const result = UpdateAiSettingsResponse.parse({
      provider: settings.provider as "openai" | "openrouter" | "gemini",
      model: settings.model,
      apiKey: settings.apiKey ? "***" + settings.apiKey.slice(-4) : null,
      temperature: settings.temperature / 10,
      maxTokens: settings.maxTokens,
      autoReply: settings.autoReply,
      systemPrompt: settings.systemPrompt || null,
      googleSheetUrl: settings.googleSheetUrl || null,
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error updating AI settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
