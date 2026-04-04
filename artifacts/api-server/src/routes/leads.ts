import { Router } from "express";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();
const LEADS_COLLECTION = "leads";

// List leads for the authenticated user
router.get("/leads", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const snapshot = await db.collection(LEADS_COLLECTION)
      .where("userId", "==", req.user.id)
      .get();

    const leads = snapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as any),
    }));

    leads.sort((a: any, b: any) => {
      const dateA = a.createdAt?.toDate?.() || a.createdAt;
      const dateB = b.createdAt?.toDate?.() || b.createdAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    res.json(leads.map(l => ({
      ...l,
      createdAt: l.createdAt?.toDate?.() || l.createdAt,
      updatedAt: l.updatedAt?.toDate?.() || l.updatedAt,
    })));
  } catch (err) {
    logger.error({ err }, "Error fetching leads");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update an individual lead (for inline editing)
router.patch("/leads/:id", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData.id;
    delete updateData.userId;

    await db.collection(LEADS_COLLECTION).doc(id).update(updateData);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Error updating lead");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get column configuration for the user
router.get("/leads/config", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });

  try {
    const doc = await db.collection("leads_config").doc(req.user.id).get();
    if (!doc.exists) {
      // Default configuration
      const defaultConfig = {
        columns: [
          { id: "fullName", label: "Customer Name", key: "fullName", type: "text", visible: true },
          { id: "email", label: "Email", key: "email", type: "email", visible: true },
          { id: "phone", label: "Phone Number", key: "phone", type: "tel", visible: true },
          { id: "status", label: "Status", key: "status", type: "status", visible: true },
          { id: "createdAt", label: "Captured On", key: "createdAt", type: "date", visible: true },
        ]
      };
      return res.json(defaultConfig);
    }
    res.json(doc.data());
  } catch (err) {
    logger.error({ err }, "Error fetching leads config");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update column configuration
router.post("/leads/config", async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });

  try {
    await db.collection("leads_config").doc(req.user.id).set({
      columns: req.body.columns,
      updatedAt: new Date()
    }, { merge: true });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Error saving leads config");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
