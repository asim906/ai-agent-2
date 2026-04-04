import { Router } from "express";
import { db } from "@workspace/db";
import {
  GetWhatsappStatusResponse,
  GetWhatsappQrResponse,
  DisconnectWhatsappResponse,
  ToggleAutomationBody,
  ToggleAutomationResponse,
  GetAutomationStatusResponse,
} from "@workspace/api-zod";
import { whatsappService } from "../lib/whatsapp";

const router = Router();
const COLLECTION = "whatsapp_sessions";

router.get("/whatsapp/test-qr", async (req, res) => {
  try {
    const qrData = await whatsappService.getQrCode("test-user-id");
    res.json(qrData);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/whatsapp/status", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const doc = await db.collection(COLLECTION).doc(req.user.id).get();
    const session = doc.data();

    const status = whatsappService.getStatus(req.user.id);

    const result = GetWhatsappStatusResponse.parse({
      connected: status.connected || (session?.connected ?? false),
      phoneNumber: status.phoneNumber || session?.phoneNumber || null,
      automationEnabled: session?.automationEnabled ?? false,
      lastConnected: session?.lastConnected?.toDate?.()?.toISOString() || session?.lastConnected || null,
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

  // Disable caching for QR codes - they're time-sensitive and expire in 60s
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

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

router.get("/whatsapp/debug", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const session = whatsappService.getSessionDebug(req.user.id);
    res.json(session);
  } catch (err) {
    req.log.error({ err }, "Error getting WhatsApp debug info");
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
    await db.collection(COLLECTION).doc(req.user.id).set({
      connected: false,
      phoneNumber: null,
      updatedAt: new Date(),
    }, { merge: true });

    const result = DisconnectWhatsappResponse.parse({ success: true });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error disconnecting WhatsApp");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/whatsapp/debug", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const session = whatsappService.getSessionDebug(req.user.id);
    res.json(session);
  } catch (err) {
    req.log.error({ err }, "Error getting WhatsApp debug info");
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
    await db.collection(COLLECTION).doc(req.user.id).set({
      userId: req.user.id,
      automationEnabled: body.data.enabled,
      updatedAt: new Date(),
    }, { merge: true });

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
    const doc = await db.collection(COLLECTION).doc(req.user.id).get();
    const session = doc.data();

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
