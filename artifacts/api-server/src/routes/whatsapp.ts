import { Router } from "express";
import { db } from "@workspace/db";
import { whatsappSessionsTable } from "@workspace/db/schema";
import {
  GetWhatsappStatusResponse,
  GetWhatsappQrResponse,
  DisconnectWhatsappResponse,
  ToggleAutomationBody,
  ToggleAutomationResponse,
  GetAutomationStatusResponse,
} from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { whatsappService } from "../lib/whatsapp";

const router = Router();

router.get("/whatsapp/status", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const session = await db.query.whatsappSessionsTable.findFirst({
      where: eq(whatsappSessionsTable.userId, req.user.id),
    });

    const status = whatsappService.getStatus(req.user.id);

    const result = GetWhatsappStatusResponse.parse({
      connected: status.connected || (session?.connected ?? false),
      phoneNumber: status.phoneNumber || session?.phoneNumber || null,
      automationEnabled: session?.automationEnabled ?? false,
      lastConnected: session?.lastConnected?.toISOString() || null,
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting WhatsApp status");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/whatsapp/qr", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const qrData = await whatsappService.getQrCode(req.user.id);

    const result = GetWhatsappQrResponse.parse({
      qr: qrData.qr || null,
      expiresAt: qrData.expiresAt || null,
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting QR code");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/whatsapp/disconnect", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await whatsappService.disconnect(req.user.id);
    await db
      .update(whatsappSessionsTable)
      .set({ connected: false, phoneNumber: null })
      .where(eq(whatsappSessionsTable.userId, req.user.id));

    const result = DisconnectWhatsappResponse.parse({ success: true });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error disconnecting WhatsApp");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/automation/toggle", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = ToggleAutomationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  try {
    const existing = await db.query.whatsappSessionsTable.findFirst({
      where: eq(whatsappSessionsTable.userId, req.user.id),
    });

    if (existing) {
      await db
        .update(whatsappSessionsTable)
        .set({ automationEnabled: body.data.enabled })
        .where(eq(whatsappSessionsTable.userId, req.user.id));
    } else {
      await db.insert(whatsappSessionsTable).values({
        id: req.user.id,
        userId: req.user.id,
        automationEnabled: body.data.enabled,
      });
    }

    const result = ToggleAutomationResponse.parse({
      enabled: body.data.enabled,
      processedToday: 0,
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error toggling automation");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/automation/status", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const session = await db.query.whatsappSessionsTable.findFirst({
      where: eq(whatsappSessionsTable.userId, req.user.id),
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = GetAutomationStatusResponse.parse({
      enabled: session?.automationEnabled ?? false,
      processedToday: 0,
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting automation status");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
