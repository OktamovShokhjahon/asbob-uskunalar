import { Prisma, type User } from "@prisma/client";
import { config } from "../../config";
import { prisma } from "../../db";
import { AppError, fieldError } from "../../lib/errors";
import { DUMMY_HASH_PROMISE, hashPassword, newSessionToken, verifyPassword } from "../../lib/password";
import type { AuthUser } from "../../middleware/auth";

export type UserDto = {
  id: string;
  username: string;
  fullName: string;
  role: "user" | "superadmin";
  createdAt: string;
};

export function toUserDto(u: User | AuthUser): UserDto {
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    role: u.role === "superadmin" ? "superadmin" : "user",
    createdAt: u.createdAt.toISOString(),
  };
}

export async function startSession(userId: string) {
  const { token, tokenHash } = newSessionToken();
  const expiresAt = new Date(Date.now() + config.sessionTtlMs);
  // Housekeeping: drop this user's expired sessions.
  await prisma.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
  await prisma.session.create({ data: { tokenHash, userId, expiresAt } });
  return { token, expiresAt };
}

export async function register(input: { fullName: string; username: string; password: string }) {
  const taken = await prisma.user.findUnique({ where: { username: input.username }, select: { id: true } });
  if (taken) throw new AppError(409, "USERNAME_TAKEN", { username: fieldError("USERNAME_TAKEN") });

  let user: User;
  try {
    user = await prisma.user.create({
      data: {
        username: input.username,
        fullName: input.fullName,
        role: "user", // superadmin is never created through the API
        passwordHash: await hashPassword(input.password),
      },
    });
  } catch (e) {
    // Two registrations racing for the same username.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new AppError(409, "USERNAME_TAKEN", { username: fieldError("USERNAME_TAKEN") });
    }
    throw e;
  }

  return { user: toUserDto(user), ...(await startSession(user.id)) };
}

export async function login(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  // Same scrypt cost whether or not the user exists (no username probing by timing).
  const ok = await verifyPassword(password, user?.passwordHash ?? (await DUMMY_HASH_PROMISE));
  if (!user || !ok) throw new AppError(401, "INVALID_CREDENTIALS");
  // Only after a correct password, so "blocked" does not reveal which usernames exist.
  if (user.blocked) throw new AppError(403, "USER_BLOCKED");
  return { user: toUserDto(user), ...(await startSession(user.id)) };
}

export async function logout(sessionId: string) {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

/** "Barcha qurilmalardan chiqish": ends every session of the user. */
export async function logoutAll(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
}

export async function updateProfile(userId: string, fullName: string): Promise<UserDto> {
  return toUserDto(await prisma.user.update({ where: { id: userId }, data: { fullName } }));
}

/** Changes the password; other sessions end, the current one stays. */
export async function changePassword(userId: string, sessionId: string, current: string, next: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(current, user.passwordHash))) {
    throw new AppError(400, "VALIDATION_ERROR", { currentPassword: fieldError("CURRENT_PASSWORD_WRONG") });
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } }),
    prisma.session.deleteMany({ where: { userId, id: { not: sessionId } } }),
  ]);
}
