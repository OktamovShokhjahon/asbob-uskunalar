import { Router } from "express";
import { isoDateOrUndefined, parseBody } from "../../lib/validation";
import { requireSuperadmin } from "../../middleware/auth";
import { idempotency } from "../../middleware/idempotency";
import { postRateLimit } from "../../middleware/rateLimit";
import { requireJson } from "../../middleware/requireJson";
import { createRentalSchema } from "./rentals.schema";
import { createRental, getRentalOrThrow, listRentals } from "./rentals.service";

export const rentalsRouter = Router();

// POST /api/v1/rental-requests — the "Ijara soʻrovi" button (login optional; linked to the user when logged in).
rentalsRouter.post("/", postRateLimit, requireJson, idempotency, async (req, res) => {
  const input = parseBody(createRentalSchema, req.body);
  const rental = await createRental(input, req.user);
  res.location(`${req.baseUrl}/${rental.id}`).status(201).json({ data: rental });
});

// GET /api/v1/rental-requests?page&limit&q&toolId&from&to — superadmin only
rentalsRouter.get("/", requireSuperadmin, async (req, res) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20));
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 60) : undefined);
  res.set("Cache-Control", "no-store");
  res.json({
    data: await listRentals(page, limit, {
      q: str(req.query.q),
      toolId: str(req.query.toolId),
      from: isoDateOrUndefined(req.query.from),
      to: isoDateOrUndefined(req.query.to),
    }),
  });
});

// GET /api/v1/rental-requests/:id — confirmation page data.
rentalsRouter.get("/:id", async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ data: await getRentalOrThrow(req.params.id) });
});
