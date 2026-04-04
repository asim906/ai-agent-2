import { Router } from "express";
import { db } from "@workspace/db";
import {
  ListCsvFilesResponse,
  UploadCsvFileBody,
  DeleteCsvFileParams,
  DeleteCsvFileResponse,
} from "@workspace/api-zod";
import { nanoid } from "nanoid";

const router = Router();
const COLLECTION = "csv_files";

router.get("/tools/csv", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const snapshot = await db.collection(COLLECTION)
      .where("userId", "==", req.user.id)
      .orderBy("uploadedAt", "desc")
      .get();

    const files = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const result = ListCsvFilesResponse.parse(
      files.map((f: any) => ({
        id: f.id,
        filename: f.filename,
        rowCount: f.rowCount || 0,
        uploadedAt: f.uploadedAt?.toDate?.()?.toISOString() || f.uploadedAt || new Date().toISOString(),
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

    const id = nanoid();
    const now = new Date();
    const newData = {
      userId: req.user.id,
      filename: body.data.filename,
      data: body.data.data,
      rowCount: Math.max(0, rowCount),
      description: body.data.description || null,
      uploadedAt: now,
    };

    await db.collection(COLLECTION).doc(id).set(newData);

    res.status(201).json({
      id,
      filename: newData.filename,
      rowCount: newData.rowCount,
      uploadedAt: now.toISOString(),
      description: newData.description || null,
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
    const docRef = db.collection(COLLECTION).doc(params.data.id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.userId !== req.user.id) {
      res.status(404).json({ error: "CSV file not found" });
      return;
    }

    await docRef.delete();

    const result = DeleteCsvFileResponse.parse({ success: true });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error deleting CSV file");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
