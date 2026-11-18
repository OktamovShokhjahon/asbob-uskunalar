/** The 6 tools from the task ("Boshlangʻich maʼlumotlar"), as originally specified. */
export const TOOL_SEED = [
  { id: "A01", name: "Drel", description: "Teshish ishlari uchun", pricePerDay: 30000 },
  { id: "A02", name: "Narvon", description: "Uy ichidagi ishlar uchun", pricePerDay: 20000 },
  { id: "A03", name: "Proyektor", description: "Taqdimot uchun", pricePerDay: 100000 },
  { id: "A04", name: "Mikrofon", description: "Kichik tadbir uchun", pricePerDay: 40000 },
  { id: "A05", name: "Tikuv mashinasi", description: "Oddiy tikish ishlari uchun", pricePerDay: 60000 },
  { id: "A06", name: "Gilam tozalagich", description: "Gilam tozalash uchun", pricePerDay: 80000 },
] as const;

/** Icon kind per seeded tool (matches the frontend's IconKind). */
export const TOOL_ICONS: Record<string, string> = {
  A01: "drill",
  A02: "ladder",
  A03: "projector",
  A04: "mic",
  A05: "sewing",
  A06: "vacuum",
};

/** Seeded tools are approved listings owned by this account. */
export const SUPERADMIN_SEED = {
  username: "admin",
  fullName: "Superadmin",
  /** Used only outside production when SUPERADMIN_PASSWORD is not set (same as the frontend demo). */
  devPassword: "a@a@admina@a@",
};

export const SEED_LISTING_ID = /^A\d{2}$/;
