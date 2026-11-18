import rateLimit from "express-rate-limit";
import { config } from "../config";
import { errorBody, langOf } from "../lib/errors";

function limiter(perMinute: number) {
  return rateLimit({
    windowMs: 60_000,
    limit: perMinute,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => config.isTest,
    handler: (req, res) => {
      res.status(429).json(errorBody("RATE_LIMITED", langOf(req)));
    },
  });
}

/** 20 POST requests / minute / IP by default. Disabled in tests. */
export const postRateLimit = limiter(config.RATE_LIMIT_PER_MIN);

/** Stricter limit for login/register (password guessing). */
export const authRateLimit = limiter(config.AUTH_RATE_LIMIT_PER_MIN);

/** Chat messages: frequent but bounded. */
export const chatRateLimit = limiter(config.CHAT_RATE_LIMIT_PER_MIN);
