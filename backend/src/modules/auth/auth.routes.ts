import { Router } from "express";
import {
  changePasswordSchema,
  loginSchema,
  parseBody,
  passwordConfirmErrors,
  profileSchema,
  registerSchema,
} from "../../lib/validation";
import { clearSessionCookie, requireAuth, setSessionCookie } from "../../middleware/auth";
import { authRateLimit } from "../../middleware/rateLimit";
import { requireJson } from "../../middleware/requireJson";
import * as auth from "./auth.service";

export const authRouter = Router();

/**
 * Login/register set an httpOnly session cookie (used by the website) and also
 * return the token in the body for API clients that send `Authorization: Bearer`.
 */

// POST /api/v1/auth/register → 201 { user, token, expiresAt } (logged in right away)
authRouter.post("/register", authRateLimit, requireJson, async (req, res) => {
  const input = parseBody(registerSchema, req.body, passwordConfirmErrors(req.body));
  const r = await auth.register(input);
  setSessionCookie(res, r.token, r.expiresAt);
  res.status(201).json({ data: { user: r.user, token: r.token, expiresAt: r.expiresAt.toISOString() } });
});

// POST /api/v1/auth/login → 200 { user, token, expiresAt }
authRouter.post("/login", authRateLimit, requireJson, async (req, res) => {
  const input = parseBody(loginSchema, req.body);
  const r = await auth.login(input.username, input.password);
  setSessionCookie(res, r.token, r.expiresAt);
  res.json({ data: { user: r.user, token: r.token, expiresAt: r.expiresAt.toISOString() } });
});

// POST /api/v1/auth/logout → 204, ends the current session only
authRouter.post("/logout", async (req, res) => {
  if (req.sessionId) await auth.logout(req.sessionId);
  clearSessionCookie(res);
  res.status(204).end();
});

// POST /api/v1/auth/logout-all → 204, ends every session of this user
authRouter.post("/logout-all", requireAuth, async (req, res) => {
  await auth.logoutAll(req.user!.id);
  clearSessionCookie(res);
  res.status(204).end();
});

// GET /api/v1/auth/me → 200 user, 401 when not logged in
authRouter.get("/me", requireAuth, (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ data: auth.toUserDto(req.user!) });
});

// PATCH /api/v1/auth/me { fullName } — profile
authRouter.patch("/me", requireAuth, requireJson, async (req, res) => {
  const { fullName } = parseBody(profileSchema, req.body);
  res.json({ data: await auth.updateProfile(req.user!.id, fullName) });
});

// POST /api/v1/auth/password { currentPassword, password, password2 }
authRouter.post("/password", authRateLimit, requireAuth, requireJson, async (req, res) => {
  const input = parseBody(changePasswordSchema, req.body, passwordConfirmErrors(req.body));
  await auth.changePassword(req.user!.id, req.sessionId!, input.currentPassword, input.password);
  res.status(204).end();
});
