"use client";

/**
 * Client API. Every screen goes through these functions only.
 * Backed by the REST API in backend/ (see NEXT_PUBLIC_API_URL).
 */

import { ApiError, getToken, request, setToken } from "./http";
import type { Listing, ListingStatus, NewListingInput, User } from "./types";

export { ApiError };

type AuthResult = { user: User; token: string; expiresAt: string };

/* ---------------- Auth ---------------- */

export async function getSession(): Promise<User | null> {
  if (!getToken()) return null;
  try {
    return await request<User>("/auth/me");
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null; // token already cleared by request()
    throw e;
  }
}

export async function login(username: string, password: string): Promise<User> {
  const r = await request<AuthResult>("/auth/login", { method: "POST", body: { username, password } });
  setToken(r.token);
  return r.user;
}

export async function register(input: {
  fullName: string;
  username: string;
  password: string;
  password2: string;
}): Promise<User> {
  const r = await request<AuthResult>("/auth/register", { method: "POST", body: input });
  setToken(r.token);
  return r.user;
}

export async function logout(): Promise<void> {
  try {
    if (getToken()) await request<void>("/auth/logout", { method: "POST" });
  } catch {
    /* already logged out on the server: nothing to do */
  } finally {
    setToken(null);
  }
}

/* ---------------- Public listings ---------------- */

export function listApprovedListings(): Promise<Listing[]> {
  return request<Listing[]>("/listings");
}

export async function getPublicListing(id: string): Promise<Listing | null> {
  try {
    return await request<Listing>(`/listings/${encodeURIComponent(id)}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/* ---------------- User eʼlonlar ---------------- */

export function createListing(input: NewListingInput): Promise<Listing> {
  const { title, description, pricePerDay, icon, photos } = input;
  return request<Listing>("/listings", { method: "POST", body: { title, description, pricePerDay, icon, photos } });
}

/* ---------------- Photos ---------------- */

export type UploadedImage = { id: string; url: string; mime: string; size: number };

/** POST /uploads (multipart, field "images"): 1–3 images, ≤ 2 MB each. */
export function uploadImages(files: Blob[]): Promise<UploadedImage[]> {
  const form = new FormData();
  files.forEach((f, i) => form.append("images", f, f instanceof File ? f.name : `photo-${i}.jpg`));
  return request<UploadedImage[]>("/uploads", { method: "POST", body: form });
}

/** Removes an upload that is not on any eʼlon yet (best effort). */
export async function deleteUpload(id: string): Promise<void> {
  try {
    await request<void>(`/uploads/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {
    /* already gone or attached: nothing to clean up */
  }
}

export function listMyListings(): Promise<Listing[]> {
  return request<Listing[]>("/me/listings");
}

/* ---------------- Rental requests ---------------- */

export type RentalRequest = {
  id: string;
  toolId: string;
  toolName: string;
  days: number;
  pricePerDay: number;
  total: number;
  customerName: string;
  /** Present for the renter's own, the owner's and the superadmin's views only. */
  customerPhone?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  /** PENDING until the eʼlon owner approves or declines it. */
  status: RentalStatus;
  createdAt: string;
  /** The eʼlon it is for (owner's list only). */
  listing?: { id: string; title: string; icon: IconKind; photo: string | null };
};

export type RentalStatus = "PENDING" | "APPROVED" | "DECLINED";

/** Requests made for the logged-in user's own eʼlonlar ("Soʻrovlar"). */
export function listRequestsForMyListings(): Promise<RentalRequest[]> {
  return request<RentalRequest[]>("/me/listing-requests");
}

/** The owner's answer to a request. */
export function decideRentalRequest(id: string, decision: "approve" | "decline"): Promise<RentalRequest> {
  return request<RentalRequest>(`/me/listing-requests/${encodeURIComponent(id)}/${decision}`, { method: "POST" });
}

/** "Ijara soʻrovi" — no account needed. The total is computed by the server. */
export function createRentalRequest(
  input: { toolId: string; days: number; customerName: string; customerPhone: string },
  idempotencyKey: string,
): Promise<RentalRequest> {
  return request<RentalRequest>("/rental-requests", {
    method: "POST",
    body: input,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export async function getRentalRequest(id: string): Promise<RentalRequest | null> {
  try {
    return await request<RentalRequest>(`/rental-requests/${encodeURIComponent(id)}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/* ---------------- Superadmin ---------------- */

export function adminListListings(status: ListingStatus): Promise<Listing[]> {
  return request<Listing[]>(`/admin/listings?status=${status}`);
}

export function adminReviewListing(id: string, decision: "approve" | "reject", reason?: string): Promise<Listing> {
  const body = decision === "reject" && reason?.trim() ? { decision, reason: reason.trim() } : { decision };
  return request<Listing>(`/admin/listings/${encodeURIComponent(id)}/review`, { method: "POST", body });
}

export function adminStats(): Promise<{ pending: number; approved: number; rejected: number; users: number }> {
  return request("/admin/stats");
}

export function adminListUsers(): Promise<(User & { listingCount: number })[]> {
  return request("/admin/users");
}

/** Clears every user, eʼlon and rental request; ends all sessions (including this one). */
export async function adminResetDemoData(): Promise<void> {
  await request<void>("/admin/reset-demo", { method: "POST" });
  setToken(null);
}
