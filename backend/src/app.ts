import path from "node:path";
import cors from "cors";
import express, { Router } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { config } from "./config";
import { prisma } from "./db";
import { logger } from "./logger";
import { authenticate } from "./middleware/auth";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { adminRouter } from "./modules/admin/admin.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { chatRouter } from "./modules/chat/chat.routes";
import { listingsRouter } from "./modules/listings/listings.routes";
import { meRouter } from "./modules/me/me.routes";
import { quotesRouter } from "./modules/quotes/quotes.routes";
import { rentalsRouter } from "./modules/rentals/rentals.routes";
import { toolsRouter } from "./modules/tools/tools.routes";
import { uploadsRouter, uploadsStatic } from "./modules/uploads/uploads.routes";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  if (config.TRUST_PROXY > 0) app.set("trust proxy", config.TRUST_PROXY);
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true, // the website's session cookie
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Idempotency-Key", "Authorization", "Accept-Language"],
      exposedHeaders: ["Location"],
    }),
  );
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === "/api/v1/health" || req.url?.startsWith("/uploads/") === true },
      // Tokens and cookies must not end up in logs.
      redact: {
        paths: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]'],
        remove: true,
      },
    }),
  );

  // Uploaded images (public, immutable file names).
  app.use("/uploads", uploadsStatic);

  app.use(authenticate);

  // Image upload has its own larger body limit, so it is mounted before the global 10 kB parser.
  app.use("/api/v1/uploads", uploadsRouter);

  app.use(express.json({ limit: "10kb" }));

  const api = Router();

  api.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ data: { status: "ok", db: "ok" } });
    } catch {
      res.status(503).json({ data: { status: "degraded", db: "error" } });
    }
  });

  api.use("/auth", authRouter);
  api.use("/listings", listingsRouter);
  api.use("/me", meRouter);
  api.use("/conversations", chatRouter);
  api.use("/admin", adminRouter);
  api.use("/tools", toolsRouter);
  api.use("/quotes", quotesRouter);
  api.use("/rental-requests", rentalsRouter);

  app.use("/api/v1", api);

  // API contract (OpenAPI 3, YAML)
  app.get("/api/docs", (_req, res) => {
    res.type("application/yaml").sendFile(path.resolve(__dirname, "..", "openapi.yaml"));
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
