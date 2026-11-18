import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { seed } from "../../data/seed";
import { SEED_LISTING_ID } from "../../data/tools.seed";
import { prisma } from "../../db";
import { AppError } from "../../lib/errors";
import { hashPassword } from "../../lib/password";
import type { AuthUser } from "../../middleware/auth";
import { logger } from "../../logger";
import { toUserDto, type UserDto } from "../auth/auth.service";
import {
  listingInclude,
  notifyOwner,
  toListingDto,
  updateListing,
  type ListingDto,
  type ListingInput,
} from "../listings/listings.service";
import { removeUploadFiles } from "../uploads/uploads.routes";

export type AdminListingFilter = "pending" | "approved" | "rejected" | "hidden" | "all";

export async function listByStatus(filter: AdminListingFilter, admin: AuthUser, q?: string): Promise<ListingDto[]> {
  const where: Prisma.ListingWhereInput =
    filter === "all"
      ? { deletedAt: null }
      : filter === "hidden"
        ? { deletedAt: null, hidden: true }
        : { deletedAt: null, status: filter };
  const items = await prisma.listing.findMany({
    where,
    include: listingInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const needle = q?.trim().toLocaleLowerCase();
  const filtered = needle
    ? items.filter(
        (l) =>
          l.id.toLocaleLowerCase().includes(needle) ||
          l.title.toLocaleLowerCase().includes(needle) ||
          (l.owner?.username ?? "").includes(needle),
      )
    : items;
  return filtered.map((l) => toListingDto(l, admin));
}

/** Approve or reject a pending eʼlon. A listing is reviewed once per submission. */
export async function review(
  id: string,
  decision: "approve" | "reject",
  reason: string | undefined,
  admin: AuthUser,
): Promise<ListingDto> {
  const target = await prisma.listing.findFirst({ where: { id: id.trim().toUpperCase(), deletedAt: null } });
  if (!target) throw new AppError(404, "LISTING_NOT_FOUND");

  // Conditional update: two admins reviewing at once cannot both win.
  const { count } = await prisma.listing.updateMany({
    where: { id: target.id, status: "pending" },
    data: {
      status: decision === "approve" ? "approved" : "rejected",
      rejectReason: decision === "reject" ? reason || null : null,
      reviewedAt: new Date(),
    },
  });
  if (count === 0) throw new AppError(409, "ALREADY_REVIEWED");

  await notifyOwner(target, decision === "approve" ? "listing_approved" : "listing_rejected", {
    ...(decision === "reject" && reason ? { reason } : {}),
  });
  logger.info({ listingId: target.id, decision, reviewerId: admin.id }, "Listing reviewed");
  const updated = await prisma.listing.findUniqueOrThrow({ where: { id: target.id }, include: listingInclude });
  return toListingDto(updated, admin);
}

export function adminUpdate(id: string, admin: AuthUser, input: ListingInput) {
  return updateListing(id, admin, input);
}

export async function setHidden(id: string, hidden: boolean, admin: AuthUser): Promise<ListingDto> {
  const l = await prisma.listing.findFirst({ where: { id: id.trim().toUpperCase(), deletedAt: null } });
  if (!l) throw new AppError(404, "LISTING_NOT_FOUND");
  const updated = await prisma.listing.update({ where: { id: l.id }, data: { hidden }, include: listingInclude });
  if (hidden && l.ownerId !== admin.id) await notifyOwner(l, "listing_hidden");
  logger.info({ listingId: l.id, hidden, by: admin.id }, "Listing visibility changed");
  return toListingDto(updated, admin);
}

export async function adminDelete(id: string, admin: AuthUser) {
  const l = await prisma.listing.findFirst({ where: { id: id.trim().toUpperCase(), deletedAt: null } });
  if (!l) throw new AppError(404, "LISTING_NOT_FOUND");
  await prisma.$transaction([
    prisma.favorite.deleteMany({ where: { listingId: l.id } }),
    prisma.listing.update({ where: { id: l.id }, data: { deletedAt: new Date() } }),
  ]);
  logger.warn({ listingId: l.id, by: admin.id }, "Listing deleted by superadmin");
}

export async function stats() {
  const [grouped, hidden, users] = await Promise.all([
    prisma.listing.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.listing.count({ where: { deletedAt: null, hidden: true } }),
    prisma.user.count({ where: { role: "user" } }),
  ]);
  const by = (s: string) => grouped.find((g) => g.status === s)?._count._all ?? 0;
  return { pending: by("pending"), approved: by("approved"), rejected: by("rejected"), hidden, users };
}

/* ---------------- Users ---------------- */

export type AdminUserDto = UserDto & { listingCount: number; blocked: boolean };

export async function listUsers(q?: string): Promise<AdminUserDto[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { listings: { where: { deletedAt: null } } } } },
  });
  const needle = q?.trim().toLocaleLowerCase();
  return users
    .filter((u) => !needle || u.username.includes(needle) || u.fullName.toLocaleLowerCase().includes(needle))
    .map((u) => ({ ...toUserDto(u), listingCount: u._count.listings, blocked: u.blocked }));
}

export async function userDetail(id: string, admin: AuthUser) {
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) throw new AppError(404, "USER_NOT_FOUND");
  const listings = await prisma.listing.findMany({
    where: { ownerId: id, deletedAt: null },
    include: listingInclude,
    orderBy: { createdAt: "desc" },
  });
  return {
    user: { ...toUserDto(u), blocked: u.blocked, listingCount: listings.length },
    listings: listings.map((l) => toListingDto(l, admin)),
  };
}

async function targetUser(id: string) {
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) throw new AppError(404, "USER_NOT_FOUND");
  if (u.role === "superadmin") throw new AppError(400, "CANNOT_BLOCK_ADMIN");
  return u;
}

/** Blocking ends every session; the user's eʼlonlar leave the catalog while blocked. */
export async function setBlocked(id: string, blocked: boolean, admin: AuthUser): Promise<AdminUserDto> {
  const u = await targetUser(id);
  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: u.id },
      data: { blocked },
      include: { _count: { select: { listings: { where: { deletedAt: null } } } } },
    }),
    ...(blocked ? [prisma.session.deleteMany({ where: { userId: u.id } })] : []),
  ]);
  logger.warn({ userId: u.id, blocked, by: admin.id }, "User block state changed");
  return { ...toUserDto(updated), listingCount: updated._count.listings, blocked: updated.blocked };
}

/** Sets a random temporary password (shown once to the superadmin) and ends the user's sessions. */
export async function resetPassword(id: string, admin: AuthUser): Promise<{ password: string }> {
  const u = await targetUser(id);
  // 10 chars from an unambiguous alphabet (no 0/O, 1/l).
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const password = Array.from(randomBytes(10), (b) => alphabet[b % alphabet.length]).join("");
  await prisma.$transaction([
    prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(password) } }),
    prisma.session.deleteMany({ where: { userId: u.id } }),
  ]);
  logger.warn({ userId: u.id, by: admin.id }, "Password reset by superadmin");
  return { password };
}

/* ---------------- Dashboard ---------------- */

function dayKey(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function dashboard(days = 14) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const [recent, totals, listingStats] = await Promise.all([
    prisma.rentalRequest.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, total: true, toolId: true, toolName: true },
    }),
    prisma.rentalRequest.aggregate({ _count: { _all: true }, _sum: { total: true } }),
    stats(),
  ]);

  const perDay = Array.from({ length: days }, (_, i) => {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    return { date: dayKey(d), count: 0, value: 0 };
  });
  const index = new Map(perDay.map((d, i) => [d.date, i]));
  const tools = new Map<string, { toolId: string; toolName: string; count: number; value: number }>();
  for (const r of recent) {
    const i = index.get(dayKey(r.createdAt));
    if (i !== undefined) {
      perDay[i].count++;
      perDay[i].value += r.total;
    }
    const t = tools.get(r.toolId) ?? { toolId: r.toolId, toolName: r.toolName, count: 0, value: 0 };
    t.count++;
    t.value += r.total;
    tools.set(r.toolId, t);
  }

  return {
    totals: {
      requests: totals._count._all,
      value: totals._sum.total ?? 0,
      ...listingStats,
    },
    periodDays: days,
    perDay,
    topTools: [...tools.values()].sort((a, b) => b.count - a.count || b.value - a.value).slice(0, 5),
  };
}

/* ---------------- Demo reset ---------------- */

/**
 * Removes every rental request, chat, notification, favourite, upload record,
 * user eʼlon and non-superadmin account, ends all sessions, then re-seeds the 6
 * task tools. Disabled in production unless DEMO_RESET_ENABLED=true.
 */
export async function resetDemoData(byUserId: string) {
  const seeded = (await prisma.listing.findMany({ select: { id: true } }))
    .map((r) => r.id)
    .filter((id) => SEED_LISTING_ID.test(id));
  const files = (await prisma.upload.findMany({ select: { filename: true } })).map((u) => u.filename);
  await prisma.$transaction([
    prisma.message.deleteMany({}),
    prisma.conversation.deleteMany({}),
    prisma.notification.deleteMany({}),
    prisma.favorite.deleteMany({}),
    prisma.rentalRequest.deleteMany({}),
    prisma.listingPhoto.deleteMany({}),
    prisma.upload.deleteMany({}),
    prisma.session.deleteMany({}),
    prisma.listing.deleteMany({ where: { NOT: { id: { in: seeded } } } }),
    prisma.user.deleteMany({ where: { role: { not: "superadmin" } } }),
  ]);
  await removeUploadFiles(files);
  await seed(prisma);
  logger.warn({ byUserId, removedImages: files.length }, "Demo data reset");
}
