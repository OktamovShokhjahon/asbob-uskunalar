import { z, type ZodTypeAny } from "zod";
import { AppError, fieldError, isErrorCode, type FieldErrors } from "./errors";

export const MIN_DAYS = 1;
export const MAX_DAYS = 7;
export const MAX_NAME_LENGTH = 50;

/**
 * Fields the server owns, per request type. If a client sends them they are dropped
 * silently (BR-4: a client-sent total is ignored). Any other unknown field is rejected (BR-6).
 */
export const RENTAL_SERVER_FIELDS = ["id", "toolName", "pricePerDay", "total", "status", "createdAt"] as const;
export const LISTING_SERVER_FIELDS = [
  "id",
  "status",
  "ownerId",
  "ownerUsername",
  "ownerName",
  "rejectReason",
  "createdAt",
  "reviewedAt",
] as const;

// Zod messages carry our error codes; `toFieldErrors` turns them into Uzbek messages.

export const toolIdSchema = z
  .string({ required_error: "TOOL_REQUIRED", invalid_type_error: "TOOL_REQUIRED" })
  .trim()
  .min(1, "TOOL_REQUIRED")
  .transform((s) => s.toUpperCase());

export const daysSchema = z.preprocess(
  (v) => (v === null ? undefined : v), // null counts as "not provided"
  z
    .number({ required_error: "DAYS_REQUIRED", invalid_type_error: "DAYS_NOT_INTEGER" })
    .int("DAYS_NOT_INTEGER")
    .min(MIN_DAYS, "DAYS_OUT_OF_RANGE")
    .max(MAX_DAYS, "DAYS_OUT_OF_RANGE"),
);

export const customerNameSchema = z
  .string({ required_error: "NAME_REQUIRED", invalid_type_error: "NAME_REQUIRED" })
  .trim()
  .min(1, "NAME_REQUIRED")
  .max(MAX_NAME_LENGTH, "NAME_TOO_LONG")
  // eslint-disable-next-line no-control-regex
  .regex(/^[^\u0000-\u001F\u007F]*$/, "NAME_INVALID");

/** Build a strict request-body schema from a shape; `ignore` lists server-owned fields to drop. */
export function bodySchema<T extends z.ZodRawShape>(shape: T, ignore: readonly string[] = []) {
  const drop = new Set(ignore);
  const strip = (body: unknown): unknown => {
    if (typeof body !== "object" || body === null || Array.isArray(body) || drop.size === 0) return body;
    return Object.fromEntries(Object.entries(body).filter(([key]) => !drop.has(key)));
  };
  return z.preprocess(strip, z.object(shape).strict("UNKNOWN_FIELD"));
}

function toFieldErrors(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) fields[key] ??= fieldError("UNKNOWN_FIELD");
      continue;
    }
    const key = String(issue.path[0] ?? "_");
    // first error per field wins (e.g. NOT_INTEGER before OUT_OF_RANGE)
    fields[key] ??= fieldError(isErrorCode(issue.message) ? issue.message : "VALIDATION_ERROR");
  }
  return fields;
}

/**
 * Parse a request body or throw 400 with every field error at once.
 * `extra` adds cross-field errors (e.g. password confirmation) to the same response.
 */
export function parseBody<S extends ZodTypeAny>(schema: S, body: unknown, extra: FieldErrors = {}): z.output<S> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AppError(400, "INVALID_JSON");
  }
  const result = schema.safeParse(body);
  const fields = { ...(result.success ? {} : toFieldErrors(result.error)) };
  for (const [k, v] of Object.entries(extra)) fields[k] ??= v;
  if (!result.success || Object.keys(fields).length > 0) {
    throw new AppError(400, "VALIDATION_ERROR", fields);
  }
  return result.data;
}

/* ---------------- Accounts ---------------- */

export const usernameSchema = z
  .string({ required_error: "USERNAME_REQUIRED", invalid_type_error: "USERNAME_REQUIRED" })
  .trim()
  .toLowerCase()
  .min(1, "USERNAME_REQUIRED")
  .regex(/^[a-z0-9_]{3,20}$/, "USERNAME_INVALID");

export const fullNameSchema = z
  .string({ required_error: "FULLNAME_REQUIRED", invalid_type_error: "FULLNAME_REQUIRED" })
  .trim()
  .min(1, "FULLNAME_REQUIRED")
  .min(2, "FULLNAME_LENGTH")
  .max(50, "FULLNAME_LENGTH")
  // eslint-disable-next-line no-control-regex
  .regex(/^[^\u0000-\u001F\u007F]*$/, "NAME_INVALID");

export const newPasswordSchema = z
  .string({ required_error: "PASSWORD_REQUIRED", invalid_type_error: "PASSWORD_REQUIRED" })
  .min(1, "PASSWORD_REQUIRED")
  .min(6, "PASSWORD_TOO_SHORT")
  .max(100, "PASSWORD_TOO_LONG");

export const registerSchema = bodySchema({
  fullName: fullNameSchema,
  username: usernameSchema,
  password: newPasswordSchema,
  password2: z.unknown().optional(), // checked in passwordConfirmErrors()
});

export const loginSchema = bodySchema({
  username: z
    .string({ required_error: "USERNAME_REQUIRED", invalid_type_error: "USERNAME_REQUIRED" })
    .trim()
    .toLowerCase()
    .min(1, "USERNAME_REQUIRED"),
  password: z
    .string({ required_error: "PASSWORD_REQUIRED", invalid_type_error: "PASSWORD_REQUIRED" })
    .min(1, "PASSWORD_REQUIRED")
    .max(100, "PASSWORD_TOO_LONG"),
});

/** password2 is optional for API clients; when sent it must be filled and match. */
export function passwordConfirmErrors(body: unknown): FieldErrors {
  if (typeof body !== "object" || body === null || !("password2" in body)) return {};
  const { password, password2 } = body as { password?: unknown; password2?: unknown };
  if (typeof password2 !== "string" || password2 === "") return { password2: fieldError("PASSWORD2_REQUIRED") };
  if (password2 !== password) return { password2: fieldError("PASSWORD_MISMATCH") };
  return {};
}

/* ---------------- Eʼlonlar ---------------- */

export const PRICE_MIN = 1000;
export const PRICE_MAX = 10_000_000;
export const ICON_KINDS = ["drill", "ladder", "projector", "mic", "sewing", "vacuum", "box"] as const;
export const LISTING_STATUSES = ["pending", "approved", "rejected"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

// eslint-disable-next-line no-control-regex
const NO_CONTROL = /^[^\u0000-\u001F\u007F]*$/;

/** "+998 90 123 45 67", "998901234567", "90 123-45-67" → "+998 90 123 45 67"; empty → null. */
export function normalizePhone(raw: string): string | null | "INVALID" {
  const digits = raw.replace(/[\s()\-+]/g, "");
  if (digits === "") return null;
  const local = digits.startsWith("998") ? digits.slice(3) : digits;
  if (!/^\d{9}$/.test(local)) return "INVALID";
  return `+998 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
}

const phoneSchema = z
  .union([z.string(), z.null()], { errorMap: () => ({ message: "PHONE_INVALID" }) })
  .optional()
  .transform((v, ctx) => {
    if (v == null) return null;
    const p = normalizePhone(v);
    if (p === "INVALID") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "PHONE_INVALID" });
      return z.NEVER;
    }
    return p;
  });

/** Renter's phone on a rental request: required, normalized to "+998 XX XXX XX XX". */
export const customerPhoneSchema = z
  .string({ required_error: "PHONE_REQUIRED", invalid_type_error: "PHONE_REQUIRED" })
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (p === null || p === "INVALID") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: p === null ? "PHONE_REQUIRED" : "PHONE_INVALID" });
      return z.NEVER;
    }
    return p;
  });

const detailsSchema = z
  .union([z.string(), z.null()], { errorMap: () => ({ message: "TEXT_INVALID" }) })
  .optional()
  .transform((v) => (v == null || v.trim() === "" ? null : v.trim()))
  .refine((v) => v === null || v.length <= 1000, "DETAILS_TOO_LONG")
  // newlines allowed here, other control characters are not
  // eslint-disable-next-line no-control-regex
  .refine((v) => v === null || /^[^\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]*$/.test(v), "TEXT_INVALID");

/** Upload ids from POST /uploads. Every eʼlon needs 1–3 photos. */
const photosSchema = z
  .array(z.string().regex(/^c[a-z0-9]{20,30}$/, "PHOTOS_INVALID"), {
    required_error: "PHOTOS_REQUIRED",
    invalid_type_error: "PHOTOS_INVALID",
  })
  .min(1, "PHOTOS_REQUIRED")
  .max(3, "PHOTOS_TOO_MANY");

export const createListingSchema = bodySchema({
  details: detailsSchema,
  phone: phoneSchema,
  photos: photosSchema,
  title: z
    .string({ required_error: "TITLE_REQUIRED", invalid_type_error: "TITLE_REQUIRED" })
    .trim()
    .min(1, "TITLE_REQUIRED")
    .min(2, "TITLE_LENGTH")
    .max(40, "TITLE_LENGTH")
    .regex(NO_CONTROL, "TEXT_INVALID"),
  description: z
    .string({ required_error: "DESCRIPTION_REQUIRED", invalid_type_error: "DESCRIPTION_REQUIRED" })
    .trim()
    .min(1, "DESCRIPTION_REQUIRED")
    .min(5, "DESCRIPTION_LENGTH")
    .max(80, "DESCRIPTION_LENGTH")
    .regex(NO_CONTROL, "TEXT_INVALID"),
  pricePerDay: z.preprocess(
    (v) => (v === null ? undefined : v),
    z
      .number({ required_error: "PRICE_REQUIRED", invalid_type_error: "PRICE_NOT_INTEGER" })
      .int("PRICE_NOT_INTEGER")
      .min(PRICE_MIN, "PRICE_OUT_OF_RANGE")
      .max(PRICE_MAX, "PRICE_OUT_OF_RANGE"),
  ),
  icon: z.enum(ICON_KINDS, { errorMap: () => ({ message: "ICON_INVALID" }) }).default("box"),
}, LISTING_SERVER_FIELDS);

export const reviewSchema = bodySchema({
  decision: z.enum(["approve", "reject"], { errorMap: () => ({ message: "DECISION_INVALID" }) }),
  reason: z
    .string({ invalid_type_error: "REASON_TOO_LONG" })
    .trim()
    .max(200, "REASON_TOO_LONG")
    .optional(),
});

export const listingStatusQuery = z
  .enum([...LISTING_STATUSES, "hidden", "all"], { errorMap: () => ({ message: "STATUS_INVALID" }) })
  .default("pending");

/* ---------------- Rental dates ---------------- */

/** Today's date (server local time) as YYYY-MM-DD. */
export function todayIso(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** "2026-11-20" + 2 days → "2026-11-22" (calendar math in UTC, no DST surprises). */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isRealDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export const startDateSchema = z
  .union([z.string(), z.null()], { errorMap: () => ({ message: "START_DATE_INVALID" }) })
  .optional()
  .transform((v, ctx) => {
    if (v == null || v.trim() === "") return null;
    const iso = v.trim();
    const issue = (message: string) => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
      return z.NEVER;
    };
    if (!isRealDate(iso)) return issue("START_DATE_INVALID");
    const today = todayIso();
    if (iso < today) return issue("START_DATE_PAST");
    if (iso > addDaysIso(today, 90)) return issue("START_DATE_TOO_FAR");
    return iso;
  });

export function isoDateOrUndefined(v: unknown): string | undefined {
  return typeof v === "string" && isRealDate(v) ? v : undefined;
}

/* ---------------- Account ---------------- */

export const profileSchema = bodySchema({ fullName: fullNameSchema });

export const changePasswordSchema = bodySchema({
  currentPassword: z
    .string({ required_error: "PASSWORD_REQUIRED", invalid_type_error: "PASSWORD_REQUIRED" })
    .min(1, "PASSWORD_REQUIRED"),
  password: newPasswordSchema,
  password2: z.unknown().optional(),
});

/* ---------------- Chat ---------------- */

export const messageSchema = bodySchema({
  body: z
    .string({ required_error: "MESSAGE_REQUIRED", invalid_type_error: "MESSAGE_REQUIRED" })
    .trim()
    .min(1, "MESSAGE_REQUIRED")
    .max(1000, "MESSAGE_TOO_LONG")
    // eslint-disable-next-line no-control-regex
    .refine((v) => /^[^\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]*$/.test(v), "TEXT_INVALID"),
});
