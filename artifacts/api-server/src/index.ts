import app from "./app";
import { logger } from "./lib/logger";
import { whatsappService } from "./lib/whatsapp";

const rawPort = process.env["PORT"] || "5001";

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Automatically restore all previously-connected WhatsApp sessions
  // so the AI can receive messages immediately without a page reload.
  whatsappService.reconnectAllSessions().catch((err) =>
    logger.error({ err }, "Failed to auto-reconnect WhatsApp sessions")
  );
});
