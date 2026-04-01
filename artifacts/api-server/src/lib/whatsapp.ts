import { logger } from "./logger";

interface WhatsappStatus {
  connected: boolean;
  phoneNumber: string | null;
}

interface QrData {
  qr: string | null;
  expiresAt: string | null;
}

class WhatsappService {
  private sessions = new Map<string, WhatsappStatus>();
  private qrCodes = new Map<string, QrData>();

  getStatus(userId: string): WhatsappStatus {
    return this.sessions.get(userId) || { connected: false, phoneNumber: null };
  }

  async getQrCode(userId: string): Promise<QrData> {
    const existing = this.qrCodes.get(userId);
    if (existing && existing.expiresAt && new Date(existing.expiresAt) > new Date()) {
      return existing;
    }

    const qrData = await this.generateQrPlaceholder(userId);
    this.qrCodes.set(userId, qrData);
    return qrData;
  }

  private async generateQrPlaceholder(userId: string): Promise<QrData> {
    try {
      const qrString = `whatsapp-connect-${userId}-${Date.now()}`;
      const expiresAt = new Date(Date.now() + 60000).toISOString();

      const qrDataUrl = await this.generateQrDataUrl(qrString);

      return { qr: qrDataUrl, expiresAt };
    } catch (err) {
      logger.error({ err }, "Error generating QR code");
      return { qr: null, expiresAt: null };
    }
  }

  private async generateQrDataUrl(text: string): Promise<string> {
    const size = 200;
    const modules = 25;
    const moduleSize = Math.floor(size / modules);

    const hash = Array.from(text).reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0);

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
    svg += `<rect width="${size}" height="${size}" fill="white"/>`;

    for (let row = 0; row < modules; row++) {
      for (let col = 0; col < modules; col++) {
        const isCorner =
          (row < 7 && col < 7) ||
          (row < 7 && col >= modules - 7) ||
          (row >= modules - 7 && col < 7);

        const seed = (hash ^ (row * 31) ^ (col * 97)) & 1;
        const shouldFill = isCorner ? (row === 0 || row === 6 || col === 0 || col === 6 || (row >= 2 && row <= 4 && col >= 2 && col <= 4)) : seed === 1;

        if (shouldFill) {
          svg += `<rect x="${col * moduleSize}" y="${row * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
        }
      }
    }

    svg += `</svg>`;

    const base64 = Buffer.from(svg).toString("base64");
    return `data:image/svg+xml;base64,${base64}`;
  }

  async disconnect(userId: string): Promise<void> {
    this.sessions.delete(userId);
    this.qrCodes.delete(userId);
    logger.info({ userId }, "WhatsApp session disconnected");
  }
}

export const whatsappService = new WhatsappService();
