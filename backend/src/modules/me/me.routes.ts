import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { unreadMessageCount } from "../chat/chat.service";
import { listByOwner, listFavorites } from "../listings/listings.service";
import { listNotifications, markAllRead, unreadNotificationCount } from "../notifications/notifications.service";
import { decideRequest, listMyRentals, listRequestsForMyListings } from "../rentals/rentals.service";

/** /api/v1/me/* — everything about the logged-in user. */
export const meRouter = Router();
meRouter.use(requireAuth, (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// GET /me/listings — the user's own eʼlonlar, every status (kabinet)
meRouter.get("/listings", async (req, res) => {
  res.json({ data: await listByOwner(req.user!.id) });
});

// GET /me/favorites — "Saqlanganlar"
meRouter.get("/favorites", async (req, res) => {
  res.json({ data: await listFavorites(req.user!) });
});

// GET /me/rental-requests — "Mening soʻrovlarim"
meRouter.get("/rental-requests", async (req, res) => {
  res.json({ data: await listMyRentals(req.user!.id) });
});

// GET /me/listing-requests — requests for my eʼlonlar (with the eʼlon each is for)
meRouter.get("/listing-requests", async (req, res) => {
  res.json({ data: await listRequestsForMyListings(req.user!.id) });
});

// POST /me/listing-requests/:id/approve | /decline — the owner's answer
meRouter.post("/listing-requests/:id/approve", async (req, res) => {
  res.json({ data: await decideRequest(String(req.params.id), req.user!, "approve") });
});
meRouter.post("/listing-requests/:id/decline", async (req, res) => {
  res.json({ data: await decideRequest(String(req.params.id), req.user!, "decline") });
});

// GET /me/notifications
meRouter.get("/notifications", async (req, res) => {
  res.json({ data: await listNotifications(req.user!.id) });
});

// POST /me/notifications/read — mark all as read
meRouter.post("/notifications/read", async (req, res) => {
  await markAllRead(req.user!.id);
  res.status(204).end();
});

// GET /me/summary — header badges
meRouter.get("/summary", async (req, res) => {
  const [notifications, messages] = await Promise.all([
    unreadNotificationCount(req.user!.id),
    unreadMessageCount(req.user!.id),
  ]);
  res.json({ data: { notifications, messages } });
});
