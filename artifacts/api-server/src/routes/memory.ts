import { Router } from "express";
import { db } from "@workspace/db";
import { customMemoryTable, messagesTable } from "@workspace/db/schema";
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
import { eq, and, count } from "drizzle-orm";

const router = Router();

router.get("/memory/chats", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [{ value: totalMessages }] = await db
      .select({ value: count() })
      .from(messagesTable)
      .where(eq(messagesTable.userId, req.user.id));

    const result = GetMemoryChatsResponse.parse({
      totalConversations: 0,
      totalMessages: totalMessages ?? 0,
      storageUsed: `${Math.round((totalMessages ?? 0) * 0.2)}KB`,
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
    const memories = await db.query.customMemoryTable.findMany({
      where: eq(customMemoryTable.userId, req.user.id),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });

    const result = ListCustomMemoryResponse.parse(
      memories.map((m) => ({
        id: String(m.id),
        question: m.question,
        answer: m.answer,
        category: m.category || null,
        createdAt: m.createdAt.toISOString(),
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
    const [created] = await db
      .insert(customMemoryTable)
      .values({
        userId: req.user.id,
        question: body.data.question,
        answer: body.data.answer,
        category: body.data.category || null,
      })
      .returning();

    res.status(201).json({
      id: String(created.id),
      question: created.question,
      answer: created.answer,
      category: created.category || null,
      createdAt: created.createdAt.toISOString(),
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
    const [updated] = await db
      .update(customMemoryTable)
      .set({
        question: body.data.question,
        answer: body.data.answer,
        category: body.data.category || null,
      })
      .where(
        and(
          eq(customMemoryTable.id, parseInt(params.data.id)),
          eq(customMemoryTable.userId, req.user.id)
        )
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Memory entry not found" });
      return;
    }

    const result = UpdateCustomMemoryResponse.parse({
      id: String(updated.id),
      question: updated.question,
      answer: updated.answer,
      category: updated.category || null,
      createdAt: updated.createdAt.toISOString(),
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
    await db
      .delete(customMemoryTable)
      .where(
        and(
          eq(customMemoryTable.id, parseInt(params.data.id)),
          eq(customMemoryTable.userId, req.user.id)
        )
      );

    const result = DeleteCustomMemoryResponse.parse({ success: true });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error deleting custom memory");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
