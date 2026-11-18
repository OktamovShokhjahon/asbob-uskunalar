import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError, errorBody, langOf } from "../lib/errors";
import { logger } from "../logger";

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, "NOT_FOUND"));
};

type BodyParserError = Error & { type?: string; status?: number };

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const lang = langOf(req);
  if (err instanceof AppError) {
    res.status(err.status).json(err.toJSON(lang));
    return;
  }

  const bpErr = err as BodyParserError;
  if (bpErr?.type === "entity.parse.failed") {
    res.status(400).json(errorBody("INVALID_JSON", lang));
    return;
  }
  if (bpErr?.type === "entity.too.large") {
    res.status(413).json(errorBody("PAYLOAD_TOO_LARGE", lang));
    return;
  }

  // Unknown error: stack goes to logs only, never to the client.
  logger.error({ err, method: req.method, url: req.originalUrl }, "Unhandled error");
  res.status(500).json(errorBody("INTERNAL_ERROR", lang));
};
