import type { RequestHandler } from "express";
import { AppError } from "../lib/errors";

/** POST bodies must be JSON (415 otherwise). */
export const requireJson: RequestHandler = (req, _res, next) => {
  if (!req.is("application/json")) {
    return next(new AppError(415, "UNSUPPORTED_MEDIA_TYPE"));
  }
  next();
};
