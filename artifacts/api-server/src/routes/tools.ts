import { Router } from "express";
import { db } from "@workspace/db";
import { csvFilesTable } from "@workspace/db/schema";
import {
  ListCsvFilesResponse,
  UploadCsvFileBody,
  DeleteCsvFileParams,
  DeleteCsvFileResponse,
} from "@workspace/api-zod";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/tools/csv", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const files = await db.query.csvFilesTable.findMany({
      where: eq(csvFilesTable.userId, req.user.id),
      orderBy: (t, { desc }) => [desc(t.uploadedAt)],
    });

    const result = ListCsvFilesResponse.parse(
      files.map((f) => ({
        id: String(f.id),
        filename: f.filename,
        rowCount: f.rowCount,
        uploadedAt: f.uploadedAt.toISOString(),
        description: f.description || null,
      }))
    );
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error listing CSV files");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/tools/csv", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = UploadCsvFileBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  try {
    let rowCount = 0;
    try {
      const decoded = Buffer.from(body.data.data, "base64").toString("utf-8");
      rowCount = decoded.split("\n").filter((l) => l.trim()).length - 1;
    } catch {
      rowCount = 0;
    }

    const [created] = await db
      .insert(csvFilesTable)
      .values({
        userId: req.user.id,
        filename: body.data.filename,
        data: body.data.data,
        rowCount: Math.max(0, rowCount),
        description: body.data.description || null,
      })
      .returning();

    res.status(201).json({
      id: String(created.id),
      filename: created.filename,
      rowCount: created.rowCount,
      uploadedAt: created.uploadedAt.toISOString(),
      description: created.description || null,
    });
  } catch (err) {
    req.log.error({ err }, "Error uploading CSV file");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/tools/csv/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = DeleteCsvFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  try {
    await db
      .delete(csvFilesTable)
      .where(
        and(
          eq(csvFilesTable.id, parseInt(params.data.id)),
          eq(csvFilesTable.userId, req.user.id)
        )
      );

    const result = DeleteCsvFileResponse.parse({ success: true });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error deleting CSV file");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
