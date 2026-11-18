import { Router } from "express";
import { calcTotal } from "../../lib/money";
import { parseBody } from "../../lib/validation";
import { postRateLimit } from "../../middleware/rateLimit";
import { requireJson } from "../../middleware/requireJson";
import { getToolOrThrow } from "../tools/tools.service";
import { quoteSchema } from "./quotes.schema";

export const quotesRouter = Router();

// POST /api/v1/quotes — calculates the total, saves nothing.
quotesRouter.post("/", postRateLimit, requireJson, async (req, res) => {
  const input = parseBody(quoteSchema, req.body);
  const tool = await getToolOrThrow(input.toolId);

  res.json({
    data: {
      toolId: tool.id,
      toolName: tool.title,
      days: input.days,
      pricePerDay: tool.pricePerDay,
      total: calcTotal(input.days, tool.pricePerDay),
    },
  });
});
