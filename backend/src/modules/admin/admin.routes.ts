import { Router } from "express";
import { config } from "../../config";
import { AppError, fieldError } from "../../lib/errors";
import { createListingSchema, listingStatusQuery, parseBody, reviewSchema } from "../../lib/validation";
import { clearSessionCookie, requireSuperadmin } from "../../middleware/auth";
import { requireJson } from "../../middleware/requireJson";
import * as admin from "./admin.service";

/** Superadmin panel. Every route needs a superadmin session. */
export const adminRouter = Router();

adminRouter.use(requireSuperadmin);
adminRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 60) : undefined);

// GET /api/v1/admin/stats
adminRouter.get("/stats", async (_req, res) => {
  res.json({ data: await admin.stats() });
});

// GET /api/v1/admin/dashboard
adminRouter.get("/dashboard", async (_req, res) => {
  res.json({ data: await admin.dashboard() });
});

// GET /api/v1/admin/listings?status=pending|approved|rejected|hidden|all&q= (default pending)
adminRouter.get("/listings", async (req, res) => {
  const parsed = listingStatusQuery.safeParse(req.query.status);
  if (!parsed.success) {
    throw new AppError(400, "VALIDATION_ERROR", { status: fieldError("STATUS_INVALID") });
  }
  res.json({ data: await admin.listByStatus(parsed.data, req.user!, str(req.query.q)) });
});

// POST /api/v1/admin/listings/:id/review { decision: "approve" | "reject", reason? }
adminRouter.post("/listings/:id/review", requireJson, async (req, res) => {
  const input = parseBody(reviewSchema, req.body);
  res.json({ data: await admin.review(String(req.params.id), input.decision, input.reason, req.user!) });
});

// PATCH /api/v1/admin/listings/:id — edit any eʼlon (status unchanged)
adminRouter.patch("/listings/:id", requireJson, async (req, res) => {
  const input = parseBody(createListingSchema, req.body);
  res.json({ data: await admin.adminUpdate(String(req.params.id), req.user!, input) });
});

// POST /api/v1/admin/listings/:id/hide | /unhide
adminRouter.post("/listings/:id/hide", async (req, res) => {
  res.json({ data: await admin.setHidden(String(req.params.id), true, req.user!) });
});
adminRouter.post("/listings/:id/unhide", async (req, res) => {
  res.json({ data: await admin.setHidden(String(req.params.id), false, req.user!) });
});

// DELETE /api/v1/admin/listings/:id
adminRouter.delete("/listings/:id", async (req, res) => {
  await admin.adminDelete(String(req.params.id), req.user!);
  res.status(204).end();
});

// GET /api/v1/admin/users?q=
adminRouter.get("/users", async (req, res) => {
  res.json({ data: await admin.listUsers(str(req.query.q)) });
});

// GET /api/v1/admin/users/:id — user + their eʼlonlar
adminRouter.get("/users/:id", async (req, res) => {
  res.json({ data: await admin.userDetail(String(req.params.id), req.user!) });
});

// POST /api/v1/admin/users/:id/block | /unblock
adminRouter.post("/users/:id/block", async (req, res) => {
  res.json({ data: await admin.setBlocked(String(req.params.id), true, req.user!) });
});
adminRouter.post("/users/:id/unblock", async (req, res) => {
  res.json({ data: await admin.setBlocked(String(req.params.id), false, req.user!) });
});

// POST /api/v1/admin/users/:id/reset-password → { password } (shown once)
adminRouter.post("/users/:id/reset-password", async (req, res) => {
  res.json({ data: await admin.resetPassword(String(req.params.id), req.user!) });
});

// POST /api/v1/admin/reset-demo → 204 (ends every session, including this one)
adminRouter.post("/reset-demo", async (req, res) => {
  if (!config.demoResetEnabled) throw new AppError(403, "DEMO_RESET_DISABLED");
  await admin.resetDemoData(req.user!.id);
  clearSessionCookie(res);
  res.status(204).end();
});
