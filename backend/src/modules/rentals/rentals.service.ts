import type { Prisma, RentalRequest } from "@prisma/client";
import { prisma } from "../../db";
import { AppError } from "../../lib/errors";
import { calcTotal } from "../../lib/money";
import { addDaysIso } from "../../lib/validation";
import { logger } from "../../logger";
import type { AuthUser } from "../../middleware/auth";
import { notify } from "../notifications/notifications.service";
import { getToolOrThrow } from "../tools/tools.service";
import type { CreateRentalInput } from "./rentals.schema";

/**
 * Request lifecycle: PENDING (sent, waiting for the owner) → APPROVED | DECLINED.
 * Rows created before owner decisions existed hold "CONFIRMED"; they read as PENDING.
 */
export type RentalStatus = "PENDING" | "APPROVED" | "DECLINED";

export function rentalStatus(raw: string): RentalStatus {
  return raw === "APPROVED" || raw === "DECLINED" ? raw : "PENDING";
}

/** The eʼlon a request is for, as the owner's request list shows it. */
export type RentalListingDto = { id: string; title: string; icon: string; photo: string | null };

export type RentalDto = {
  id: string;
  toolId: string;
  toolName: string;
  days: number;
  pricePerDay: number;
  total: number;
  customerName: string;
  /** Personal data: only in the owner's, the renter's own and the superadmin's views. */
  customerPhone?: string | null;
  startDate: string | null;
  endDate: string | null;
  status: RentalStatus;
  createdAt: string;
  listing?: RentalListingDto;
};

export function toRentalDto(r: RentalRequest, withPhone = true): RentalDto {
  return {
    id: r.id,
    toolId: r.toolId,
    toolName: r.toolName,
    days: r.days,
    pricePerDay: r.pricePerDay,
    total: r.total,
    customerName: r.customerName,
    ...(withPhone ? { customerPhone: r.customerPhone } : {}),
    startDate: r.startDate,
    endDate: r.endDate,
    status: rentalStatus(r.status),
    createdAt: r.createdAt.toISOString(),
  };
}

/** Validated input -> saved request. Price and total always come from the DB, never the client. */
export async function createRental(input: CreateRentalInput, renter?: AuthUser): Promise<RentalDto> {
  const tool = await getToolOrThrow(input.toolId);
  const startDate = input.startDate ?? null;

  const rental = await prisma.rentalRequest.create({
    data: {
      toolId: tool.id,
      toolName: tool.title,
      days: input.days,
      pricePerDay: tool.pricePerDay,
      total: calcTotal(input.days, tool.pricePerDay),
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      startDate,
      endDate: startDate ? addDaysIso(startDate, input.days - 1) : null,
      userId: renter?.id ?? null,
      status: "PENDING", // the owner approves or declines it in the cabinet
    },
  });

  // The owner hears about requests for their eʼlon (not about their own).
  if (tool.ownerId && tool.ownerId !== renter?.id) {
    await notify(tool.ownerId, "rental_request", {
      listingId: tool.id,
      title: tool.title,
      days: rental.days,
      total: rental.total,
      customerName: rental.customerName,
      customerPhone: rental.customerPhone,
      startDate: rental.startDate,
    });
  }

  // No customerName / customerPhone here: personal data.
  logger.info(
    { rentalId: rental.id, toolId: rental.toolId, days: rental.days, total: rental.total },
    "Rental request created",
  );

  return toRentalDto(rental);
}

export async function getRentalOrThrow(id: string): Promise<RentalDto> {
  const rental = await prisma.rentalRequest.findUnique({ where: { id } });
  if (!rental) throw new AppError(404, "REQUEST_NOT_FOUND");
  // Public by its unguessable id: no phone number here.
  return toRentalDto(rental, false);
}

export type RentalFilters = { q?: string; toolId?: string; from?: string; to?: string };

function filterWhere(f: RentalFilters): Prisma.RentalRequestWhereInput {
  const createdAt: Prisma.DateTimeFilter = {};
  if (f.from) createdAt.gte = new Date(`${f.from}T00:00:00`);
  if (f.to) createdAt.lt = new Date(new Date(`${f.to}T00:00:00`).getTime() + 86_400_000);
  return {
    ...(f.toolId ? { toolId: f.toolId.toUpperCase() } : {}),
    ...(f.from || f.to ? { createdAt } : {}),
  };
}

/** Superadmin list, newest first. `q` matches the customer name or tool name (case-insensitive, Unicode). */
export async function listRentals(page: number, limit: number, filters: RentalFilters = {}) {
  const where = filterWhere(filters);
  const needle = filters.q?.trim().toLocaleLowerCase();

  if (!needle) {
    const [items, total] = await Promise.all([
      prisma.rentalRequest.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.rentalRequest.count({ where }),
    ]);
    return { items: items.map((r) => toRentalDto(r)), page, limit, total };
  }

  const all = await prisma.rentalRequest.findMany({ where, orderBy: { createdAt: "desc" } });
  const matched = all.filter(
    (r) => r.customerName.toLocaleLowerCase().includes(needle) || r.toolName.toLocaleLowerCase().includes(needle),
  );
  return {
    items: matched.slice((page - 1) * limit, page * limit).map((r) => toRentalDto(r)),
    page,
    limit,
    total: matched.length,
  };
}

/** "Mening soʻrovlarim": requests the user sent while logged in. */
export async function listMyRentals(userId: string): Promise<RentalDto[]> {
  const rows = await prisma.rentalRequest.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 200 });
  return rows.map((r) => toRentalDto(r));
}

const listingForRequest = {
  select: {
    id: true,
    title: true,
    icon: true,
    photos: { select: { upload: { select: { filename: true } } }, orderBy: { position: "asc" }, take: 1 },
  },
} as const satisfies Prisma.ListingDefaultArgs;

type RowWithListing = RentalRequest & {
  listing: { id: string; title: string; icon: string; photos: { upload: { filename: string } }[] };
};

function withListing(r: RowWithListing): RentalDto {
  const photo = r.listing.photos[0]?.upload.filename;
  return {
    ...toRentalDto(r),
    listing: {
      id: r.listing.id,
      title: r.listing.title,
      icon: r.listing.icon,
      photo: photo ? `/uploads/${photo}` : null,
    },
  };
}

/** Requests made for the user's own eʼlonlar, with the eʼlon each one is for. */
export async function listRequestsForMyListings(ownerId: string): Promise<RentalDto[]> {
  const rows = await prisma.rentalRequest.findMany({
    where: { listing: { ownerId } },
    include: { listing: listingForRequest },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map(withListing);
}

/**
 * The eʼlon owner (or the superadmin) approves or declines a pending request.
 * A request is decided once; the renter is notified when they had an account.
 */
export async function decideRequest(
  id: string,
  user: AuthUser,
  decision: "approve" | "decline",
): Promise<RentalDto> {
  const r = await prisma.rentalRequest.findUnique({
    where: { id },
    include: { listing: { select: { ...listingForRequest.select, ownerId: true } } },
  });
  if (!r) throw new AppError(404, "REQUEST_NOT_FOUND");
  if (user.role !== "superadmin" && r.listing.ownerId !== user.id) throw new AppError(403, "NOT_OWNER");

  const status: RentalStatus = decision === "approve" ? "APPROVED" : "DECLINED";
  // Conditional update: a second click (or a second tab) cannot decide twice.
  const { count } = await prisma.rentalRequest.updateMany({
    where: { id: r.id, status: { in: ["PENDING", "CONFIRMED"] } },
    data: { status },
  });
  if (count === 0) throw new AppError(409, "REQUEST_ALREADY_DECIDED");

  if (r.userId) {
    await notify(r.userId, decision === "approve" ? "rental_approved" : "rental_declined", {
      requestId: r.id,
      listingId: r.toolId,
      title: r.toolName,
      days: r.days,
      total: r.total,
    });
  }
  logger.info({ rentalId: r.id, status, by: user.id }, "Rental request decided");
  return withListing({ ...r, status });
}
