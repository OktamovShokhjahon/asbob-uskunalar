import type { RequestHandler, Response } from "express";
import { config } from "../config";
import { prisma } from "../db";
import { AppError } from "../lib/errors";
import { hashToken } from "../lib/password";

export type Role = "user" | "superadmin";

export type AuthUser = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  createdAt: Date;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionId?: string;
    }
  }
}

function bearerToken(header: string | undefined): string | null {
  const m = header?.match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : null;
}

function cookieToken(header: string | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === config.cookie.name) return decodeURIComponent(v.join("=")) || null;
  }
  return null;
}

/** Sets the httpOnly session cookie (the website's login). */
export function setSessionCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(config.cookie.name, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookie.secure,
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(config.cookie.name, { httpOnly: true, sameSite: "lax", secure: config.cookie.secure, path: "/" });
}

/**
 * Optional authentication for every request. The token comes from the httpOnly
 * cookie (website) or `Authorization: Bearer` (API clients, tests). A valid,
 * unexpired session of a non-blocked user sets req.user. Invalid tokens are
 * ignored here; requireAuth / requireSuperadmin decide whether that is an error.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = bearerToken(req.get("Authorization")) ?? cookieToken(req.get("Cookie"));
  if (!token) return next();

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (session && session.expiresAt > new Date() && !session.user.blocked) {
    const u = session.user;
    req.user = {
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      role: u.role === "superadmin" ? "superadmin" : "user",
      createdAt: u.createdAt,
    };
    req.sessionId = session.id;
  }
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(new AppError(401, "UNAUTHORIZED"));
  next();
};

export const requireSuperadmin: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(new AppError(401, "UNAUTHORIZED"));
  if (req.user.role !== "superadmin") return next(new AppError(403, "FORBIDDEN"));
  next();
};
