import { Router } from "express";
import { messageSchema, parseBody } from "../../lib/validation";
import { requireAuth } from "../../middleware/auth";
import { chatRateLimit } from "../../middleware/rateLimit";
import { requireJson } from "../../middleware/requireJson";
import { getConversation, listConversations, sendMessage } from "./chat.service";

/** /api/v1/conversations — chat between renters and eʼlon owners. */
export const chatRouter = Router();
chatRouter.use(requireAuth, (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// GET /conversations — my chats, newest first, with unread counts
chatRouter.get("/", async (req, res) => {
  res.json({ data: await listConversations(req.user!.id) });
});

// GET /conversations/:id?after=<ISO> — messages (all, or newer than `after`); marks read
chatRouter.get("/:id", async (req, res) => {
  const raw = typeof req.query.after === "string" ? new Date(req.query.after) : undefined;
  const after = raw && !Number.isNaN(raw.getTime()) ? raw : undefined;
  res.json({ data: await getConversation(String(req.params.id), req.user!.id, after) });
});

// POST /conversations/:id/messages { body }
chatRouter.post("/:id/messages", chatRateLimit, requireJson, async (req, res) => {
  const { body } = parseBody(messageSchema, req.body);
  res.status(201).json({ data: await sendMessage(String(req.params.id), req.user!.id, body) });
});
