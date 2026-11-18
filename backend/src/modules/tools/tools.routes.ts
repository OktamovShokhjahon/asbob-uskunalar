import { Router } from "express";
import { getToolOrThrow, listTools, toToolDto } from "./tools.service";

export const toolsRouter = Router();

// GET /api/v1/tools?q=dre
toolsRouter.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  res.set("Cache-Control", "public, max-age=60");
  res.json({ data: await listTools(q) });
});

// GET /api/v1/tools/:id
toolsRouter.get("/:id", async (req, res) => {
  const tool = await getToolOrThrow(req.params.id);
  res.set("Cache-Control", "public, max-age=60");
  res.json({ data: toToolDto(tool) });
});
