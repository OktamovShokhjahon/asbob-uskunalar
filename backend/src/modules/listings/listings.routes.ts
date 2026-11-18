import { Router, type Request } from "express";
import { AppError } from "../../lib/errors";
import { ICON_KINDS, createListingSchema, messageSchema, parseBody } from "../../lib/validation";
import { requireAuth } from "../../middleware/auth";
import { chatRateLimit, postRateLimit } from "../../middleware/rateLimit";
import { requireJson } from "../../middleware/requireJson";
import { startConversation } from "../chat/chat.service";
import {
  addFavorite,
  createListing,
  deleteListing,
  favoriteIdsOf,
  getApproved,
  listApproved,
  removeFavorite,
  setPaused,
  similarTo,
  toListingDto,
  updateListing,
  type CatalogQuery,
} from "./listings.service";

export const listingsRouter = Router();

function intParam(v: unknown): number | undefined {
  if (typeof v !== "string" || !/^\d{1,9}$/.test(v)) return undefined;
  return Number(v);
}

function catalogQuery(req: Request): CatalogQuery {
  const { q, icon, sort } = req.query;
  return {
    q: typeof q === "string" ? q.slice(0, 60) : undefined,
    icon: typeof icon === "string" && (ICON_KINDS as readonly string[]).includes(icon) ? icon : undefined,
    minPrice: intParam(req.query.minPrice),
    maxPrice: intParam(req.query.maxPrice),
    sort: sort === "price_asc" || sort === "price_desc" || sort === "newest" ? sort : "default",
  };
}

// GET /api/v1/listings?q=&icon=&minPrice=&maxPrice=&sort= — public catalog
listingsRouter.get("/", async (req, res) => {
  const [items, favs] = await Promise.all([listApproved(catalogQuery(req)), favoriteIdsOf(req.user?.id)]);
  res.json({ data: items.map((l) => toListingDto(l, req.user, favs)) });
});

// GET /api/v1/listings/:id — one public eʼlon + similar ones (detail page)
listingsRouter.get("/:id", async (req, res) => {
  const l = await getApproved(String(req.params.id));
  if (!l) throw new AppError(404, "LISTING_NOT_FOUND");
  const [similar, favs] = await Promise.all([similarTo(l), favoriteIdsOf(req.user?.id)]);
  res.json({
    data: { ...toListingDto(l, req.user, favs), similar: similar.map((s) => toListingDto(s, req.user, favs)) },
  });
});

// POST /api/v1/listings — "Eʼlon berish"
listingsRouter.post("/", postRateLimit, requireAuth, requireJson, async (req, res) => {
  const input = parseBody(createListingSchema, req.body);
  const listing = await createListing(req.user!, input);
  res.location(`${req.baseUrl}/${listing.id}`).status(201).json({ data: listing });
});

// PATCH /api/v1/listings/:id — owner edit (goes back to review)
listingsRouter.patch("/:id", postRateLimit, requireAuth, requireJson, async (req, res) => {
  const input = parseBody(createListingSchema, req.body);
  res.json({ data: await updateListing(String(req.params.id), req.user!, input) });
});

// DELETE /api/v1/listings/:id — owner delete (soft)
listingsRouter.delete("/:id", requireAuth, async (req, res) => {
  await deleteListing(String(req.params.id), req.user!);
  res.status(204).end();
});

// POST /api/v1/listings/:id/pause | /resume — "Vaqtincha yopish"
listingsRouter.post("/:id/pause", requireAuth, async (req, res) => {
  res.json({ data: await setPaused(String(req.params.id), req.user!, true) });
});
listingsRouter.post("/:id/resume", requireAuth, async (req, res) => {
  res.json({ data: await setPaused(String(req.params.id), req.user!, false) });
});

// PUT / DELETE /api/v1/listings/:id/favorite
listingsRouter.put("/:id/favorite", requireAuth, async (req, res) => {
  await addFavorite(req.user!.id, String(req.params.id));
  res.status(204).end();
});
listingsRouter.delete("/:id/favorite", requireAuth, async (req, res) => {
  await removeFavorite(req.user!.id, String(req.params.id));
  res.status(204).end();
});

// POST /api/v1/listings/:id/messages { body } — first message to the owner (starts or reuses the chat)
listingsRouter.post("/:id/messages", chatRateLimit, requireAuth, requireJson, async (req, res) => {
  const { body } = parseBody(messageSchema, req.body);
  const conversation = await startConversation(String(req.params.id), req.user!, body);
  res.status(201).json({ data: conversation });
});
