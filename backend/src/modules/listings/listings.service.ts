import { Prisma, type Listing, type User } from "@prisma/client";
import { SEED_LISTING_ID } from "../../data/tools.seed";
import { prisma } from "../../db";
import { AppError, fieldError } from "../../lib/errors";
import type { ListingStatus } from "../../lib/validation";
import type { AuthUser } from "../../middleware/auth";
import { notify } from "../notifications/notifications.service";

type Owner = Pick<User, "id" | "username" | "fullName" | "blocked">;
type Photo = { position: number; upload: { filename: string } };
export type ListingFull = Listing & { owner: Owner | null; photos: Photo[] };

/** Shape returned to clients (matches the frontend's `Listing` type). */
export type ListingDto = {
  id: string;
  title: string;
  description: string;
  details: string | null;
  phone: string | null;
  pricePerDay: number;
  icon: string;
  photos: string[];
  ownerId: string;
  ownerUsername: string;
  ownerName: string;
  status: ListingStatus;
  rejectReason?: string;
  paused: boolean;
  hidden: boolean;
  deleted: boolean;
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
};

export const listingInclude = {
  owner: { select: { id: true, username: true, fullName: true, blocked: true } },
  photos: { select: { position: true, upload: { select: { filename: true } } }, orderBy: { position: "asc" } },
} as const satisfies Prisma.ListingInclude;

/** Kept for older imports. */
export const withOwner = listingInclude;

/** Visible in the public catalog and rentable. */
export const PUBLIC_WHERE = {
  status: "approved",
  paused: false,
  hidden: false,
  deletedAt: null,
  OR: [{ ownerId: null }, { owner: { blocked: false } }],
} as const satisfies Prisma.ListingWhereInput;

export function photoUrl(filename: string) {
  return `/uploads/${filename}`;
}

/**
 * The phone number is personal data: shown to logged-in viewers only
 * (always to the owner and the superadmin).
 */
export function toListingDto(l: ListingFull, viewer?: AuthUser | null, favoriteIds?: Set<string>): ListingDto {
  const canSeePhone = !!viewer;
  return {
    id: l.id,
    title: l.title,
    description: l.description,
    details: l.details,
    phone: canSeePhone ? l.phone : null,
    pricePerDay: l.pricePerDay,
    icon: l.icon,
    photos: l.photos.map((p) => photoUrl(p.upload.filename)),
    ownerId: l.owner?.id ?? "",
    ownerUsername: l.owner?.username ?? "",
    ownerName: l.owner?.fullName ?? "",
    status: l.status as ListingStatus,
    ...(l.rejectReason ? { rejectReason: l.rejectReason } : {}),
    paused: l.paused,
    hidden: l.hidden,
    deleted: l.deletedAt !== null,
    ...(favoriteIds ? { isFavorite: favoriteIds.has(l.id) } : {}),
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    ...(l.reviewedAt ? { reviewedAt: l.reviewedAt.toISOString() } : {}),
  };
}

export async function favoriteIdsOf(userId: string | undefined): Promise<Set<string> | undefined> {
  if (!userId) return undefined;
  const rows = await prisma.favorite.findMany({ where: { userId }, select: { listingId: true } });
  return new Set(rows.map((r) => r.listingId));
}

const newestFirst = (a: Listing, b: Listing) =>
  b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id);

/** Default catalog order: the seeded task tools (A01…A06) first, then newest user eʼlonlar. */
export function catalogOrder<T extends Listing>(items: T[]): T[] {
  const seeded = items.filter((l) => SEED_LISTING_ID.test(l.id)).sort((a, b) => a.id.localeCompare(b.id));
  const rest = items.filter((l) => !SEED_LISTING_ID.test(l.id)).sort(newestFirst);
  return [...seeded, ...rest];
}

export type CatalogQuery = {
  q?: string;
  icon?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "default" | "price_asc" | "price_desc" | "newest";
};

export async function listApproved(query: CatalogQuery | string = {}): Promise<ListingFull[]> {
  const qObj: CatalogQuery = typeof query === "string" ? { q: query } : query;
  const items = await prisma.listing.findMany({
    where: {
      ...PUBLIC_WHERE,
      ...(qObj.icon ? { icon: qObj.icon } : {}),
      ...(qObj.minPrice !== undefined || qObj.maxPrice !== undefined
        ? { pricePerDay: { gte: qObj.minPrice, lte: qObj.maxPrice } }
        : {}),
    },
    include: listingInclude,
  });
  // Case-insensitive search in JS: SQLite's LIKE is ASCII-only for case folding.
  const needle = qObj.q?.trim().toLocaleLowerCase();
  const filtered = needle
    ? items.filter(
        (l) => l.title.toLocaleLowerCase().includes(needle) || l.description.toLocaleLowerCase().includes(needle),
      )
    : items;

  switch (qObj.sort) {
    case "price_asc":
      return filtered.sort((a, b) => a.pricePerDay - b.pricePerDay || a.id.localeCompare(b.id));
    case "price_desc":
      return filtered.sort((a, b) => b.pricePerDay - a.pricePerDay || a.id.localeCompare(b.id));
    case "newest":
      return filtered.sort(newestFirst);
    default:
      return catalogOrder(filtered);
  }
}

/** Public, rentable eʼlon (case-insensitive id) or null. */
export async function getApproved(id: string): Promise<ListingFull | null> {
  return prisma.listing.findFirst({ where: { id: id.trim().toUpperCase(), ...PUBLIC_WHERE }, include: listingInclude });
}

/** Same type, similar price, excluding this one. */
export async function similarTo(l: Listing, take = 3): Promise<ListingFull[]> {
  const same = await prisma.listing.findMany({
    where: { ...PUBLIC_WHERE, id: { not: l.id }, icon: l.icon },
    include: listingInclude,
  });
  const others =
    same.length >= take
      ? []
      : await prisma.listing.findMany({
          where: { ...PUBLIC_WHERE, id: { notIn: [l.id, ...same.map((s) => s.id)] } },
          include: listingInclude,
        });
  const byPrice = (a: Listing, b: Listing) =>
    Math.abs(a.pricePerDay - l.pricePerDay) - Math.abs(b.pricePerDay - l.pricePerDay);
  return [...same.sort(byPrice), ...others.sort(byPrice)].slice(0, take);
}

export async function listByOwner(ownerId: string): Promise<ListingDto[]> {
  const items = await prisma.listing.findMany({ where: { ownerId, deletedAt: null }, include: listingInclude });
  return items.sort(newestFirst).map((l) => toListingDto(l, { id: ownerId } as AuthUser));
}

/** An eʼlon the user may manage: theirs (or any, for the superadmin), not deleted. */
export async function getManageable(id: string, user: AuthUser): Promise<ListingFull> {
  const l = await prisma.listing.findFirst({
    where: { id: id.trim().toUpperCase(), deletedAt: null },
    include: listingInclude,
  });
  if (!l) throw new AppError(404, "LISTING_NOT_FOUND");
  if (user.role !== "superadmin" && l.ownerId !== user.id) throw new AppError(403, "NOT_OWNER");
  return l;
}

async function nextListingId(): Promise<string> {
  const rows = await prisma.listing.findMany({ where: { id: { startsWith: "E" } }, select: { id: true } });
  const max = rows.reduce((m, r) => Math.max(m, Number(r.id.slice(1)) || 0), 0);
  return `E${String(max + 1).padStart(3, "0")}`;
}

export type ListingInput = {
  title: string;
  description: string;
  details: string | null;
  phone: string | null;
  pricePerDay: number;
  icon: string;
  photos: string[];
};

/** Upload ids → verified uploads owned by `userId` (or already on this eʼlon). */
async function resolvePhotos(photoIds: string[], userId: string, listingId?: string) {
  const unique = [...new Set(photoIds)];
  if (unique.length === 0) return [];
  const uploads = await prisma.upload.findMany({
    where: {
      id: { in: unique },
      OR: [{ userId }, ...(listingId ? [{ photos: { some: { listingId } } }] : [])],
    },
    select: { id: true },
  });
  if (uploads.length !== unique.length) {
    throw new AppError(400, "VALIDATION_ERROR", { photos: fieldError("PHOTOS_INVALID") });
  }
  return unique;
}

/** User eʼlon → pending review. The superadmin's own eʼlonlar are approved immediately. */
export async function createListing(owner: AuthUser, input: ListingInput): Promise<ListingDto> {
  const isAdmin = owner.role === "superadmin";
  const now = new Date();
  const { photos, ...fields } = input;
  const uploadIds = await resolvePhotos(photos, owner.id);

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const created = await prisma.listing.create({
        data: {
          id: await nextListingId(),
          ...fields,
          ownerId: owner.id,
          status: isAdmin ? "approved" : "pending",
          reviewedAt: isAdmin ? now : null,
          photos: { create: uploadIds.map((uploadId, position) => ({ uploadId, position })) },
        },
        include: listingInclude,
      });
      return toListingDto(created, owner);
    } catch (e) {
      // Another eʼlon took the same id in between: retry with the next one.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new AppError(500, "INTERNAL_ERROR");
}

/**
 * Edit. An owner's edit sends the eʼlon back to review (also how a rejected
 * eʼlon is resubmitted). The superadmin's edits keep the current status.
 */
export async function updateListing(id: string, user: AuthUser, input: ListingInput): Promise<ListingDto> {
  const current = await getManageable(id, user);
  const { photos, ...fields } = input;
  const uploadIds = await resolvePhotos(photos, user.id, current.id);
  const reReview = user.role !== "superadmin";

  const updated = await prisma.$transaction(async (tx) => {
    await tx.listingPhoto.deleteMany({ where: { listingId: current.id } });
    return tx.listing.update({
      where: { id: current.id },
      data: {
        ...fields,
        ...(reReview ? { status: "pending", rejectReason: null, reviewedAt: null } : {}),
        photos: { create: uploadIds.map((uploadId, position) => ({ uploadId, position })) },
      },
      include: listingInclude,
    });
  });
  return toListingDto(updated, user);
}

export async function setPaused(id: string, user: AuthUser, paused: boolean): Promise<ListingDto> {
  const l = await getManageable(id, user);
  const updated = await prisma.listing.update({ where: { id: l.id }, data: { paused }, include: listingInclude });
  return toListingDto(updated, user);
}

/** Soft delete: the eʼlon disappears everywhere, rental history keeps its snapshot. */
export async function deleteListing(id: string, user: AuthUser): Promise<void> {
  const l = await getManageable(id, user);
  await prisma.$transaction([
    prisma.favorite.deleteMany({ where: { listingId: l.id } }),
    prisma.listing.update({ where: { id: l.id }, data: { deletedAt: new Date() } }),
  ]);
}

/* ---------------- Favourites ---------------- */

export async function addFavorite(userId: string, listingId: string) {
  const l = await getApproved(listingId);
  if (!l) throw new AppError(404, "LISTING_NOT_FOUND");
  await prisma.favorite.upsert({
    where: { userId_listingId: { userId, listingId: l.id } },
    update: {},
    create: { userId, listingId: l.id },
  });
}

export async function removeFavorite(userId: string, listingId: string) {
  await prisma.favorite.deleteMany({ where: { userId, listingId: listingId.trim().toUpperCase() } });
}

export async function listFavorites(user: AuthUser): Promise<ListingDto[]> {
  const rows = await prisma.favorite.findMany({
    where: { userId: user.id, listing: PUBLIC_WHERE },
    include: { listing: { include: listingInclude } },
    orderBy: { createdAt: "desc" },
  });
  const ids = new Set(rows.map((r) => r.listingId));
  return rows.map((r) => toListingDto(r.listing, user, ids));
}

/** Notifies the owner when their eʼlon was reviewed or hidden. */
export async function notifyOwner(
  l: Pick<Listing, "id" | "title" | "ownerId">,
  type: "listing_approved" | "listing_rejected" | "listing_hidden",
  extra: Record<string, unknown> = {},
) {
  if (!l.ownerId) return;
  await notify(l.ownerId, type, { listingId: l.id, title: l.title, ...extra });
}
