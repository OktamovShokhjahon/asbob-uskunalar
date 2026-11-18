export type Role = "user" | "superadmin";

export type User = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  createdAt: string;
};

export type ListingStatus = "pending" | "approved" | "rejected";

export type IconKind = "drill" | "ladder" | "projector" | "mic" | "sewing" | "vacuum" | "box";

/** An eʼlon: a tool offered for daily rent. */
export type Listing = {
  id: string;
  title: string;
  description: string;
  pricePerDay: number;
  icon: IconKind;
  /** Image paths ("/uploads/…"), first one is the cover. May be empty for the six seeded tools. */
  photos?: string[];
  details?: string | null;
  phone?: string | null;
  ownerId: string;
  ownerUsername: string;
  ownerName: string;
  status: ListingStatus;
  rejectReason?: string;
  createdAt: string;
  reviewedAt?: string;
};

export type NewListingInput = {
  title: string;
  description: string;
  pricePerDay: number;
  icon: IconKind;
  /** Upload ids from POST /uploads, in display order (1–3). */
  photos: string[];
};

/** Most photos one eʼlon may have (server rule). */
export const MAX_PHOTOS = 3;

export const ICON_OPTIONS: { value: IconKind; label: string }[] = [
  { value: "drill", label: "Elektr asbob" },
  { value: "ladder", label: "Narvon / qurilish" },
  { value: "projector", label: "Proyektor / ekran" },
  { value: "mic", label: "Ovoz texnikasi" },
  { value: "sewing", label: "Tikuv" },
  { value: "vacuum", label: "Tozalash" },
  { value: "box", label: "Boshqa" },
];

export const STATUS_LABEL: Record<ListingStatus, string> = {
  pending: "Tekshiruvda",
  approved: "Tasdiqlangan",
  rejected: "Rad etilgan",
};
