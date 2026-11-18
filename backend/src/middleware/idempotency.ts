import type { RequestHandler } from "express";

const TTL_MS = 10 * 60_000;
const MAX_KEY_LENGTH = 100;

type Stored = { status: number; body: unknown; location?: string; expiresAt: number };
const store = new Map<string, Stored>();

/**
 * Optional `Idempotency-Key` header: a repeated POST with the same key within
 * 10 minutes returns the first response instead of creating a second record.
 * In-memory: fine for a single-instance demo.
 */
export const idempotency: RequestHandler = (req, res, next) => {
  const key = req.get("Idempotency-Key");
  if (!key || key.length > MAX_KEY_LENGTH) return next();

  const now = Date.now();
  for (const [k, v] of store) if (v.expiresAt <= now) store.delete(k);

  const hit = store.get(key);
  if (hit) {
    if (hit.location) res.location(hit.location);
    res.set("Idempotent-Replayed", "true");
    res.status(hit.status).json(hit.body);
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const location = res.get("Location");
      store.set(key, { status: res.statusCode, body, location, expiresAt: Date.now() + TTL_MS });
    }
    return originalJson(body);
  }) as typeof res.json;
  next();
};
