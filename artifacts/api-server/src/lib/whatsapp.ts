import path from "node:path";
import os from "node:os";
import { logger } from "./logger";
import { db } from "@workspace/db";
import { generateAiResponse } from "./ai";

interface WhatsappStatus {
  connected: boolean;
  phoneNumber: string | null;
}

interface QrData {
  qr: string | null;
  expiresAt: string | null;
}

interface SessionState {
  status: WhatsappStatus;
  qr: QrData;
  socket: unknown | null;
  starting: boolean;
}

const baileysLogger = {
  level: "warn",
  trace: (_obj: unknown, _msg?: string) => {},
  debug: (_obj: unknown, _msg?: string) => {},
  info: (_obj: unknown, _msg?: string) => {},
  warn: (obj: unknown, msg?: string) =>
    logger.warn({ baileys: obj }, msg ?? "baileys warn"),
  error: (obj: unknown, msg?: string) =>
    logger.error({ baileys: obj }, msg ?? "baileys error"),
  fatal: (obj: unknown, msg?: string) =>
    logger.error({ baileys: obj }, msg ?? "baileys fatal"),
  child: (_opts: unknown) => baileysLogger,
} as never;

class WhatsappService {
  private sessions = new Map<string, SessionState>();

  private getSession(userId: string): SessionState {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {
        status: { connected: false, phoneNumber: null },
        qr: { qr: null, expiresAt: null },
        socket: null,
        starting: false,
      });
    }
    return this.sessions.get(userId)!;
  }

  /**
   * Called once on server startup. Finds all previously-connected sessions
   * in Firestore and automatically re-establishes their WhatsApp sockets
   * so the AI can receive and send messages without requiring a page reload.
   */
  async reconnectAllSessions(): Promise<void> {
    try {
      const snapshot = await db.collection("whatsapp_sessions")
        .where("connected", "==", true)
        .get();

      if (snapshot.empty) {
        logger.info("Auto-reconnect: No previously connected sessions found.");
        return;
      }

      logger.info({ count: snapshot.size }, "Auto-reconnect: Found sessions to restore");

      for (const doc of snapshot.docs) {
        const userId = doc.id;
        logger.info({ userId }, "Auto-reconnect: Starting session for user");
        this.startSession(userId).catch((err) =>
          logger.error({ err, userId }, "Auto-reconnect: Failed to start session")
        );
      }
    } catch (err) {
      logger.error({ err }, "Auto-reconnect: Error reading sessions from Firestore");
    }
  }
  
  async sendMessage(userId: string, jid: string, text: string) {
    const session = this.getSession(userId);
    const sock = session.socket as any;
    if (!sock) throw new Error("WhatsApp not connected");
    
    await sock.sendMessage(jid, { text });
  }

  getStatus(userId: string): WhatsappStatus {
    return this.getSession(userId).status;
  }

  async getQrCode(userId: string): Promise<QrData> {
    const session = this.getSession(userId);

    if (session.status.connected) {
      logger.info({ userId }, "getQrCode: already connected, returning null");
      return { qr: null, expiresAt: null };
    }

    const existing = session.qr;
    if (
      existing.qr &&
      existing.expiresAt &&
      new Date(existing.expiresAt) > new Date()
    ) {
      logger.info({ userId }, "getQrCode: returning cached QR");
      return existing;
    }

    if (!session.socket && !session.starting) {
      logger.info({ userId }, "getQrCode: starting new session");
      this.startSession(userId).catch((err) =>
        logger.error({ err, userId }, "startSession threw")
      );
    }

    logger.info({ userId }, "getQrCode: waiting for QR generation");
    // Reduce loop to 20 seconds for faster API response, 
    // frontend will poll again if needed.
    for (let i = 0; i < 20; i++) {
      const s = this.getSession(userId);
      if (s.qr.qr) {
        console.log(`QR found at iteration ${i} for user ${userId}`);
        return s.qr;
      }
      if (s.status.connected) {
        return { qr: null, expiresAt: null };
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    logger.warn({ userId }, "getQrCode: Returning current state (may be null)");
    return this.getSession(userId).qr;
  }

  private async startSession(userId: string): Promise<void> {
    const session = this.getSession(userId);
    if (session.socket || session.starting) return;

    session.starting = true;
    console.log(`Baileys: Starting session for user ${userId}...`);

    try {
      const {
        default: makeWASocket,
        useMultiFileAuthState,
        DisconnectReason,
        fetchLatestBaileysVersion,
      } = await import("@whiskeysockets/baileys");

      let version = [2, 3000, 1015970030] as [number, number, number];
      try {
        console.log("Baileys: Fetching latest version...");
        const versionPromise = fetchLatestBaileysVersion();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Version fetch timeout")), 10_000)
        );
        const result = (await Promise.race([versionPromise, timeoutPromise])) as any;
        version = result.version;
        console.log("Baileys: Using version", version);
      } catch (err) {
        console.warn("Baileys: Failed to fetch version, using fallback", err);
      }

      const authDir = path.join(process.cwd(), "auth", "whatsapp-sessions", userId);
      console.log(`Baileys: Using PERSISTENT auth directory ${authDir}`);
      const { state, saveCreds } = await useMultiFileAuthState(authDir);

      console.log("Baileys: Creating socket...");
      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: baileysLogger,
        connectTimeoutMs: 60_000,
        keepAliveIntervalMs: 10_000,
        retryRequestDelayMs: 500,
        markOnlineOnConnect: false,
        syncFullHistory: false,
      });

      const s = this.getSession(userId);
      s.socket = sock;
      s.starting = false;

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("messaging-history.set", async ({ chats, messages, isLatest }) => {
        console.log(`Baileys: messaging-history.set - ${chats.length} chats, ${messages.length} messages, isLatest: ${isLatest}`);
        logger.info({ userId, chats: chats.length, messages: messages.length, isLatest }, "Messaging history sync starting");
        const CHATS_COLLECTION = "chats";
        const MESSAGES_COLLECTION = "messages";

        for (const chat of chats) {
          if (!chat.id || chat.id === "status@broadcast") continue;
          await db.collection(CHATS_COLLECTION).doc(`${userId}_${chat.id}`).set({
            userId,
            name: chat.name || null,
            phoneNumber: chat.id.split("@")[0] || null,
            isGroup: chat.id.endsWith("@g.us"),
            unreadCount: chat.unreadCount || 0,
            lastMessage: null,
            lastMessageAt: new Date(),
            updatedAt: new Date(),
          }, { merge: true });
        }
        console.log(`Baileys: Synced ${chats.length} history chats to Firestore for user ${userId}`);

        for (const msg of messages) {
          if (!msg.key.remoteJid || !msg.key.id || msg.key.remoteJid === "status@broadcast") continue;
          const timestamp = (typeof msg.messageTimestamp === "number")
            ? new Date(msg.messageTimestamp * 1000)
            : new Date();

          await db.collection(MESSAGES_COLLECTION).doc(`${userId}_${msg.key.id}`).set({
            chatId: msg.key.remoteJid,
            userId,
            content: msg.message?.conversation || msg.message?.extendedTextMessage?.text || "",
            fromMe: msg.key.fromMe || false,
            timestamp,
            type: "text",
            isAiGenerated: false,
          }, { merge: true });

          await db.collection(CHATS_COLLECTION).doc(`${userId}_${msg.key.remoteJid}`).set({
            userId,
            lastMessage: msg.message?.conversation || msg.message?.extendedTextMessage?.text || "[Media/Other]",
            lastMessageAt: timestamp,
            updatedAt: new Date(),
          }, { merge: true });
        }
      });

      sock.ev.on("chats.upsert", async (newChats) => {
        const CHATS_COLLECTION = "chats";
        for (const chat of newChats) {
          if (!chat.id || chat.id === "status@broadcast") continue;
          await db.collection(CHATS_COLLECTION).doc(`${userId}_${chat.id}`).set({
            userId,
            name: chat.name || null,
            phoneNumber: chat.id.split("@")[0] || null,
            isGroup: chat.id.endsWith("@g.us"),
            updatedAt: new Date(),
          }, { merge: true });
        }
        console.log(`Baileys: chats.upsert - Synced ${newChats.length} new/updated chats for user ${userId}`);
      });

      sock.ev.on("contacts.upsert", async (newContacts) => {
        console.log(`Baileys: contacts.upsert - Received ${newContacts.length} contacts`);
        const CHATS_COLLECTION = "chats";
        for (const contact of newContacts) {
          if (!contact.id) continue;
          await db.collection(CHATS_COLLECTION).doc(`${userId}_${contact.id}`).set({
            userId,
            name: contact.name || contact.notify || contact.verifiedName || null,
            phoneNumber: contact.id.split("@")[0] || null,
            updatedAt: new Date(),
          }, { merge: true });
        }
        console.log(`Baileys: contacts.upsert - Synced ${newContacts.length} contacts for user ${userId}`);
      });

      sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;
        console.log(`Baileys: messages.upsert - Received ${messages.length} messages`);
        const MESSAGES_COLLECTION = "messages";
        const CHATS_COLLECTION = "chats";

        for (const msg of messages) {
          if (!msg.key.remoteJid || !msg.key.id || msg.key.remoteJid === "status@broadcast") continue;
          const content = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
          if (!content && !msg.message?.imageMessage && !msg.message?.videoMessage) continue;

          const timestamp = (typeof msg.messageTimestamp === "number")
            ? new Date(msg.messageTimestamp * 1000)
            : new Date();

          await db.collection(MESSAGES_COLLECTION).doc(`${userId}_${msg.key.id}`).set({
            chatId: msg.key.remoteJid,
            userId,
            content: content || "[Media]",
            fromMe: msg.key.fromMe || false,
            timestamp,
            type: msg.message?.imageMessage ? "image" : msg.message?.videoMessage ? "video" : "text",
            isAiGenerated: false,
          }, { merge: true });

          await db.collection(CHATS_COLLECTION).doc(`${userId}_${msg.key.remoteJid}`).set({
            userId,
            lastMessage: content || "[Media]",
            lastMessageAt: timestamp,
            updatedAt: new Date(),
          }, { merge: true });

          // --- AI AGENT AUTOMATION ---
          if (!msg.key.fromMe) {
            const logDebug = async (step: string, data: any = {}) => {
              try {
                console.log(`[AI DEBUG] ${step}`, data);
                await db.collection("debug_logs").add({ step, data, userId, timestamp: new Date() });
              } catch(e) {}
            };

            try {
              await logDebug("1_TRIGGER_START", { remoteJid: msg.key.remoteJid, content: content.substring(0, 50) });
              
              // 1. Fetch Session Automation State (Global Toggle)
              const sessionDoc = await db.collection("whatsapp_sessions").doc(userId).get();
              const sessionData = sessionDoc.data();
              const isGlobalAiEnabled = !!sessionData?.automationEnabled;
              await logDebug("2_GLOBAL_CHECK", { isGlobalAiEnabled, sessionData });
              
              if (isGlobalAiEnabled) {
                // 2. Fetch Chat Automation State (Per-Chat Toggle)
                const prefixedChatId = `${userId}_${msg.key.remoteJid}`;
                const chatDoc = await db.collection("chats").doc(prefixedChatId).get();
                const chatData = chatDoc.data();
                const isChatAiEnabled = chatData?.automationEnabled !== false; // default true if not set
                await logDebug("3_CHAT_CHECK", { isChatAiEnabled, prefixedChatId });
                
                if (isChatAiEnabled) {
                  await logDebug("4_CALLING_AI", { modelArgId: msg.key.remoteJid });
                  const aiResponse = await generateAiResponse(userId, msg.key.remoteJid, content);
                  await logDebug("5_AI_RESPONSE_RECEIVED", { aiResponseLength: aiResponse?.length || 0, isNull: !aiResponse });
                  
                  if (aiResponse) {
                    await logDebug("6_SENDING_TO_WHATSAPP");
                    await sock.sendMessage(msg.key.remoteJid, { text: aiResponse });
                    
                    const aiMsgId = `ai_${Date.now()}`;
                    const aiTimestamp = new Date();
                    
                    await db.collection("messages").doc(`${userId}_${aiMsgId}`).set({
                      chatId: msg.key.remoteJid,
                      userId,
                      content: aiResponse,
                      fromMe: true,
                      timestamp: aiTimestamp,
                      type: "text",
                      isAiGenerated: true,
                    });
                    
                    await db.collection("chats").doc(`${userId}_${msg.key.remoteJid}`).set({
                      lastMessage: aiResponse,
                      lastMessageAt: aiTimestamp,
                      updatedAt: aiTimestamp,
                    }, { merge: true });
                    
                    await logDebug("7_SUCCESS_DB_SAVED");
                  }
                }
              }
            } catch (triggerError: any) {
              await logDebug("ERROR_IN_TRIGGER", { message: triggerError.message, stack: triggerError.stack });
              console.error(`AI TRIGGER ERROR for user ${userId}:`, triggerError);
            }
          }
        }
        console.log(`Baileys: messages.upsert - Synced ${messages.length} real-time messages for user ${userId}`);
      });

      sock.ev.on("connection.update", async (update) => {
        console.log(`Baileys: connection.update - ${JSON.stringify(update)}`);
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log("Baileys generated QR for", userId);
          const current = this.getSession(userId);
          current.qr = {
            qr,
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          };
          logger.info({ userId, qrLength: qr.length }, "WhatsApp QR code generated and stored");
          
          // Persist QR to Firestore for better reliability
          try {
            await db.collection("whatsapp_sessions").doc(userId).set({
              qr: qr,
              qrExpiresAt: current.qr.expiresAt,
              updatedAt: new Date(),
            }, { merge: true });
          } catch (e) {}
        }

        if (connection === "open") {
          const current = this.getSession(userId);
          const phoneNumber = (sock.user?.id ?? "").split(":")[0] || null;
          current.status = {
            connected: true,
            phoneNumber,
          };
          current.qr = { qr: null, expiresAt: null };
          
          logger.info({ userId }, "WhatsApp connected");

          // PERSIST CONNECTION STATE TO FIRESTORE
          try {
            await db.collection("whatsapp_sessions").doc(userId).set({
              connected: true,
              phoneNumber,
              lastConnected: new Date(),
              updatedAt: new Date(),
              qr: null, // Clear QR
              qrExpiresAt: null,
            }, { merge: true });
            console.log(`Firestore: Updated connection state for ${userId}`);
          } catch (err: any) {
            console.error(`Firestore ERROR updating connection status for ${userId}:`, err.message);
          }
        }

        if (connection === "close") {
          const current = this.getSession(userId);
          const err = lastDisconnect?.error as any;
          const code = err?.output?.statusCode;
          const message = err?.message ?? "unknown";

          current.socket = null;
          current.starting = false;

          if (code === DisconnectReason.loggedOut) {
            current.status = { connected: false, phoneNumber: null };
            current.qr = { qr: null, expiresAt: null };
            logger.info({ userId }, "WhatsApp logged out");
            
            // Persist Logout
            try {
              await db.collection("whatsapp_sessions").doc(userId).set({
                connected: false,
                phoneNumber: null,
                updatedAt: new Date(),
              }, { merge: true });
            } catch (e) {}
          } else {
            current.status = { connected: false, phoneNumber: null };
            logger.warn({ userId, code, message }, "WhatsApp connection closed — will reconnect on next QR request");
            
            // Persist Disconnection
            try {
              await db.collection("whatsapp_sessions").doc(userId).set({
                connected: false,
                updatedAt: new Date(),
              }, { merge: true });
            } catch (e) {}
          }
        }
      });
    } catch (err) {
      logger.error({ err, userId }, "Failed to start WhatsApp session");
      const s = this.getSession(userId);
      s.socket = null;
      s.starting = false;
    }
  }

  getSessionDebug(userId: string): Partial<SessionState> {
    const session = this.getSession(userId);
    return {
      status: session.status,
      qr: {
        qr: session.qr.qr ? `${session.qr.qr.substring(0, 50)}...` : null,
        expiresAt: session.qr.expiresAt,
      },
      socket: !!session.socket,
      starting: session.starting,
    };
  }

  async disconnect(userId: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (session?.socket) {
      try {
        const sock = session.socket as { logout: () => Promise<void> };
        await sock.logout();
      } catch (_) {}
    }
    this.sessions.delete(userId);
    logger.info({ userId }, "WhatsApp session disconnected");
  }
}

export const whatsappService = new WhatsappService();
