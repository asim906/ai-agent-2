import path from "node:path";
import os from "node:os";
import { logger } from "./logger";

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

  getStatus(userId: string): WhatsappStatus {
    return this.getSession(userId).status;
  }

  async getQrCode(userId: string): Promise<QrData> {
    const session = this.getSession(userId);

    if (session.status.connected) {
      return { qr: null, expiresAt: null };
    }

    const existing = session.qr;
    if (
      existing.qr &&
      existing.expiresAt &&
      new Date(existing.expiresAt) > new Date()
    ) {
      return existing;
    }

    if (!session.socket && !session.starting) {
      this.startSession(userId).catch((err) =>
        logger.error({ err, userId }, "startSession threw")
      );
    }

    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const s = this.getSession(userId);
      if (s.qr.qr) return s.qr;
    }

    return this.getSession(userId).qr;
  }

  private async startSession(userId: string): Promise<void> {
    const session = this.getSession(userId);
    if (session.socket || session.starting) return;

    session.starting = true;

    try {
      const {
        default: makeWASocket,
        useMultiFileAuthState,
        DisconnectReason,
        fetchLatestBaileysVersion,
      } = await import("@whiskeysockets/baileys");

      const { version } = await fetchLatestBaileysVersion();
      logger.info({ version, userId }, "Using WhatsApp Web version");

      const authDir = path.join(os.tmpdir(), "wa-auth", userId);
      const { state, saveCreds } = await useMultiFileAuthState(authDir);

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

      sock.ev.on(
        "connection.update",
        (update: {
          connection?: string;
          lastDisconnect?: { error?: unknown };
          qr?: string;
        }) => {
          const { connection, lastDisconnect, qr } = update;

          if (qr) {
            const current = this.getSession(userId);
            current.qr = {
              qr,
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
            };
            logger.info({ userId }, "WhatsApp QR code generated");
          }

          if (connection === "open") {
            const current = this.getSession(userId);
            current.status = {
              connected: true,
              phoneNumber: (sock.user?.id ?? "").split(":")[0] || null,
            };
            current.qr = { qr: null, expiresAt: null };
            logger.info({ userId }, "WhatsApp connected");
          }

          if (connection === "close") {
            const current = this.getSession(userId);
            const err = lastDisconnect?.error as
              | { output?: { statusCode?: number }; message?: string }
              | undefined;
            const code = err?.output?.statusCode;
            const message = err?.message ?? "unknown";

            current.socket = null;
            current.starting = false;

            if (code === DisconnectReason.loggedOut) {
              current.status = { connected: false, phoneNumber: null };
              current.qr = { qr: null, expiresAt: null };
              logger.info({ userId }, "WhatsApp logged out");
            } else {
              current.status = { connected: false, phoneNumber: null };
              logger.warn(
                { userId, code, message },
                "WhatsApp connection closed — will reconnect on next QR request"
              );
            }
          }
        }
      );
    } catch (err) {
      logger.error({ err, userId }, "Failed to start WhatsApp session");
      const s = this.getSession(userId);
      s.socket = null;
      s.starting = false;
    }
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
