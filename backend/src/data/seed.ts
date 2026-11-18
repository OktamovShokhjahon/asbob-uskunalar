import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { SUPERADMIN_SEED, TOOL_ICONS, TOOL_SEED } from "./tools.seed";

/**
 * Idempotent: safe to run many times.
 * - superadmin account (password from SUPERADMIN_PASSWORD; dev fallback outside production)
 * - the 6 task tools as approved listings owned by the superadmin
 */
export async function seed(db: PrismaClient) {
  const envPassword = process.env.SUPERADMIN_PASSWORD?.trim();
  if (!envPassword && process.env.NODE_ENV === "production") {
    throw new Error("Set SUPERADMIN_PASSWORD before seeding in production.");
  }

  const existing = await db.user.findUnique({ where: { username: SUPERADMIN_SEED.username } });
  const admin = await db.user.upsert({
    where: { username: SUPERADMIN_SEED.username },
    // Keep an existing password unless SUPERADMIN_PASSWORD is set explicitly.
    update: {
      role: "superadmin",
      ...(envPassword ? { passwordHash: await hashPassword(envPassword) } : {}),
    },
    create: {
      username: SUPERADMIN_SEED.username,
      fullName: SUPERADMIN_SEED.fullName,
      role: "superadmin",
      passwordHash: await hashPassword(envPassword || SUPERADMIN_SEED.devPassword),
    },
  });

  const now = new Date();
  for (const t of TOOL_SEED) {
    const data = {
      title: t.name,
      description: t.description,
      pricePerDay: t.pricePerDay,
      icon: TOOL_ICONS[t.id] ?? "box",
      status: "approved",
      rejectReason: null,
      details: null,
      phone: null,
      paused: false,
      hidden: false,
      deletedAt: null,
      ownerId: admin.id,
    };
    await db.listing.upsert({
      where: { id: t.id },
      update: data,
      create: { id: t.id, ...data, reviewedAt: now },
    });
  }

  return { adminCreated: !existing, usedDevPassword: !existing && !envPassword, listings: await db.listing.count() };
}
