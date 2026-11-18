import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import express, { Router, type RequestHandler } from "express";
import multer from "multer";
import { config } from "../../config";
import { prisma } from "../../db";
import { AppError, fieldError, type ErrorCode } from "../../lib/errors";
import { logger } from "../../logger";
import { requireAuth } from "../../middleware/auth";
import { postRateLimit } from "../../middleware/rateLimit";
import { photoUrl } from "../listings/listings.service";

/**
 * Image uploads for eʼlon photos.
 *
 * Files are written to UPLOAD_DIR (default backend/public/uploads) under a random
 * name and served at /uploads/<file>. An eʼlon references uploads by id in its
 * `photos` array (1–3 required).
 */

export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_FILES = 3;
const FIELD_NAMES = new Set(["images", "image"]);

/** Allowed types, recognised by their file signature (never by name or declared type). */
const KINDS = {
  "image/jpeg": { ext: "jpg", ok: (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": {
    ext: "png",
    ok: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  "image/webp": {
    ext: "webp",
    ok: (b: Buffer) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  },
} as const;

type Mime = keyof typeof KINDS;

function detectMime(bytes: Buffer): Mime | null {
  for (const [mime, kind] of Object.entries(KINDS) as [Mime, (typeof KINDS)[Mime]][]) {
    if (kind.ok(bytes)) return mime;
  }
  return null;
}

export type UploadDto = { id: string; url: string; mime: string; size: number };

/** Validates every file first, then writes them all; on any failure nothing is kept. */
async function saveImages(userId: string, files: Buffer[]): Promise<UploadDto[]> {
  const checked = files.map((bytes, i) => {
    if (bytes.length === 0) throw uploadError(400, "UPLOAD_INVALID", i);
    if (bytes.length > MAX_BYTES) throw uploadError(413, "UPLOAD_TOO_LARGE", i);
    const mime = detectMime(bytes);
    if (!mime) throw uploadError(400, "UPLOAD_INVALID", i);
    // Random file name: never derived from user input.
    return { bytes, mime, filename: `${randomBytes(16).toString("hex")}.${KINDS[mime].ext}` };
  });

  const written: string[] = [];
  try {
    for (const f of checked) {
      const full = path.join(config.uploadDir, f.filename);
      await writeFile(full, f.bytes, { flag: "wx" });
      written.push(full);
    }
    const rows = await prisma.$transaction(
      checked.map((f) =>
        prisma.upload.create({ data: { userId, filename: f.filename, mime: f.mime, size: f.bytes.length } }),
      ),
    );
    return rows.map((r) => ({ id: r.id, url: photoUrl(r.filename), mime: r.mime, size: r.size }));
  } catch (e) {
    await Promise.all(written.map((p) => unlink(p).catch(() => undefined)));
    throw e;
  }
}

function uploadError(status: number, code: ErrorCode, index?: number) {
  return new AppError(status, code, { [index === undefined ? "images" : `images.${index}`]: fieldError(code) });
}

/* ---------------- multipart/form-data parsing ---------------- */

const multipart = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: MAX_FILES, fields: 0, parts: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (!FIELD_NAMES.has(file.fieldname)) return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
    cb(null, true);
  },
}).any();

/** multer errors → our error envelope. */
const parseMultipart: RequestHandler = (req, res, next) => {
  multipart(req, res, (err?: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      switch (err.code) {
        case "LIMIT_FILE_SIZE":
          return next(uploadError(413, "UPLOAD_TOO_LARGE"));
        case "LIMIT_FILE_COUNT":
        case "LIMIT_PART_COUNT":
          return next(uploadError(400, "UPLOAD_TOO_MANY"));
        default:
          return next(uploadError(400, "UPLOAD_INVALID"));
      }
    }
    // Malformed multipart body.
    next(uploadError(400, "UPLOAD_INVALID"));
  });
};

/* ---------------- routes ---------------- */

mkdirSync(config.uploadDir, { recursive: true });

export const uploadsRouter = Router();

/**
 * POST /api/v1/uploads
 *
 * multipart/form-data (preferred): 1–3 files in field `images` (or `image`)
 *   → 201 { data: [{ id, url, mime, size }, …] }
 *
 * application/json (legacy): { dataUrl: "data:image/jpeg;base64,…" }
 *   → 201 { data: { id, url, mime, size } }
 *
 * Mounted before the global 10 kB JSON parser, with its own limits.
 */
uploadsRouter.post(
  "/",
  postRateLimit,
  requireAuth,
  (req, _res, next) => {
    if (req.is("multipart/form-data") || req.is("application/json")) return next();
    next(new AppError(415, "UPLOAD_MEDIA_TYPE"));
  },
  async (req, res, next) => {
    if (!req.is("multipart/form-data")) return next();
    await new Promise<void>((resolve, reject) => parseMultipart(req, res, (e?: unknown) => (e ? reject(e) : resolve())));

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw uploadError(400, "UPLOAD_REQUIRED");

    const saved = await saveImages(
      req.user!.id,
      files.map((f) => f.buffer),
    );
    logger.info({ userId: req.user!.id, count: saved.length }, "Images uploaded");
    res.status(201).json({ data: saved });
  },
  express.json({ limit: "3mb" }),
  async (req, res) => {
    const dataUrl = (req.body as { dataUrl?: unknown } | undefined)?.dataUrl;
    const m =
      typeof dataUrl === "string" ? dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/) : null;
    if (!m) throw uploadError(400, typeof dataUrl === "string" ? "UPLOAD_INVALID" : "UPLOAD_REQUIRED");

    const bytes = Buffer.from(m[2], "base64");
    // The declared type must match the actual bytes.
    if (bytes.length > 0 && bytes.length <= MAX_BYTES && detectMime(bytes) !== m[1]) {
      throw uploadError(400, "UPLOAD_INVALID");
    }
    const [saved] = await saveImages(req.user!.id, [bytes]);
    res.status(201).json({ data: saved });
  },
);

/** DELETE /api/v1/uploads/:id — remove one's own upload that is not on any eʼlon yet. */
uploadsRouter.delete("/:id", requireAuth, async (req, res) => {
  const upload = await prisma.upload.findUnique({
    where: { id: String(req.params.id) },
    include: { _count: { select: { photos: true } } },
  });
  if (!upload || upload.userId !== req.user!.id) throw new AppError(404, "UPLOAD_NOT_FOUND");
  if (upload._count.photos > 0) throw new AppError(409, "UPLOAD_IN_USE");

  await prisma.upload.delete({ where: { id: upload.id } });
  await unlink(path.join(config.uploadDir, upload.filename)).catch(() => undefined);
  res.status(204).end();
});

/** Deletes image files from disk (used by the demo reset). Only plain stored names are accepted. */
export async function removeUploadFiles(filenames: string[]) {
  await Promise.all(
    filenames
      .filter((f) => /^[a-f0-9]{32}\.(jpg|png|webp)$/.test(f))
      .map((f) => unlink(path.join(config.uploadDir, f)).catch(() => undefined)),
  );
}

/** Static serving of uploaded images: GET /uploads/<file>. */
export const uploadsStatic = express.static(config.uploadDir, {
  fallthrough: false,
  index: false,
  dotfiles: "deny",
  maxAge: "7d",
  immutable: true,
  setHeaders: (res) => {
    // Images are loaded by the website on another port: allow cross-origin embedding.
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'");
  },
});
