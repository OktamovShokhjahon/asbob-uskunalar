import "dotenv/config";
import path from "node:path";
import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : v === "true" || v === "1"));

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(20),
  AUTH_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(10),
  CHAT_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(30),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  DEMO_RESET_ENABLED: bool,
  /** Where uploaded images are written. Relative paths are resolved from the backend folder. */
  UPLOAD_DIR: z.string().default("public/uploads"),
  COOKIE_SECURE: bool,
  /** Number of reverse proxies in front of the API (Render = 1). Needed for correct client IPs in rate limits. */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

/** backend/ — from src/config.ts (tsx) and dist/config.js (built) alike. */
export const BACKEND_ROOT = path.resolve(__dirname, "..");

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

export const config = {
  ...env,
  corsOrigins: env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean),
  isTest: env.NODE_ENV === "test",
  sessionTtlMs: env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  // Demo reset is on by default everywhere except production.
  demoResetEnabled: env.DEMO_RESET_ENABLED ?? env.NODE_ENV !== "production",
  /** Absolute; default backend/public/uploads (served at /uploads/<file>). */
  uploadDir: path.resolve(BACKEND_ROOT, env.UPLOAD_DIR),
  /** Session cookie: httpOnly; Secure in production (or when COOKIE_SECURE=true). */
  cookie: {
    name: "ijara_session",
    secure: env.COOKIE_SECURE ?? env.NODE_ENV === "production",
  },
};
