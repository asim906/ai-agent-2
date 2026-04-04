import { Router } from "express";
import { db } from "@workspace/db";
import {
  GetMemoryChatsResponse,
  ListCustomMemoryResponse,
  CreateCustomMemoryBody,
  UpdateCustomMemoryParams,
  UpdateCustomMemoryBody,
  UpdateCustomMemoryResponse,
  DeleteCustomMemoryParams,
  DeleteCustomMemoryResponse,
} from "@workspace/api-zod";
import { nanoid } from "nanoid";

const router = Router();
const MEMORY_COLLECTION = "custom_memory";
const MESSAGES_COLLECTION = "messages";

router.get("/memory/chats", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const countSnapshot = await db.collection(MESSAGES_COLLECTION)
      .where("userId", "==", req.user.id)
      .count()
      .get();
    
    const totalMessages = countSnapshot.data().count;

    const result = GetMemoryChatsResponse.parse({
      totalConversations: 0,
      totalMessages: totalMessages,
      storageUsed: `${Math.round(totalMessages * 0.2)}KB`,
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting memory chats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/memory/custom", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const snapshot = await db.collection(MEMORY_COLLECTION)
      .where("userId", "==", req.user.id)
      .get();

    const memories = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() as any }))
      .sort((a, b) => {
        const timeA = a.createdAt?.toDate?.()?.getTime() || new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toDate?.()?.getTime() || new Date(b.createdAt || 0).getTime();
        return timeB - timeA; // Descending
      });

    const result = ListCustomMemoryResponse.parse(
      memories.map((m: any) => ({
        id: m.id,
        question: m.question,
        answer: m.answer,
        category: m.category || null,
        createdAt: m.createdAt?.toDate?.()?.toISOString() || m.createdAt || new Date().toISOString(),
      }))
    );
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error listing custom memory");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/memory/custom", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = CreateCustomMemoryBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  try {
    const id = nanoid();
    const now = new Date();
    const newData = {
      userId: req.user.id,
      question: body.data.question,
      answer: body.data.answer,
      category: body.data.category || null,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection(MEMORY_COLLECTION).doc(id).set(newData);

    res.status(201).json({
      id,
      question: newData.question,
      answer: newData.answer,
      category: newData.category || null,
      createdAt: now.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error creating custom memory");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/memory/custom/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = UpdateCustomMemoryParams.safeParse(req.params);
  const body = UpdateCustomMemoryBody.safeParse(req.body);

  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  try {
    const docRef = db.collection(MEMORY_COLLECTION).doc(params.data.id);
    const doc = await docRef.get();
    
    if (!doc.exists || doc.data()?.userId !== req.user.id) {
      res.status(404).json({ error: "Memory entry not found" });
      return;
    }

    const updateData = {
      question: body.data.question,
      answer: body.data.answer,
      category: body.data.category || null,
      updatedAt: new Date(),
    };

    await docRef.update(updateData);
    const updated = (await docRef.get()).data();

    const result = UpdateCustomMemoryResponse.parse({
      id: params.data.id,
      question: updated!.question,
      answer: updated!.answer,
      category: updated!.category || null,
      createdAt: updated!.createdAt?.toDate?.()?.toISOString() || updated!.createdAt || new Date().toISOString(),
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error updating custom memory");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/memory/custom/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = DeleteCustomMemoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  try {
    const docRef = db.collection(MEMORY_COLLECTION).doc(params.data.id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.userId !== req.user.id) {
      res.status(404).json({ error: "Memory entry not found" });
      return;
    }

    await docRef.delete();

    const result = DeleteCustomMemoryResponse.parse({ success: true });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error deleting custom memory");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
