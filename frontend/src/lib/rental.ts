export const MIN_DAYS = 1;
export const MAX_DAYS = 7;
export const MAX_NAME_LENGTH = 50;

/** Returns an error message, or null when the value is a whole number from 1 to 7. */
export function validateDays(raw: string): string | null {
  const v = raw.trim();
  if (v === "") return "Kunlar sonini kiriting";
  if (/^-?\d+$/.test(v)) {
    const n = Number(v);
    if (n < MIN_DAYS || n > MAX_DAYS) return "Kunlar soni 1 dan 7 gacha boʻlishi kerak";
    return null;
  }
  return "Kunlar soni butun son boʻlishi kerak";
}

/** Returns an error message, or null when the name is filled in. */
export function validateName(raw: string): string | null {
  const v = raw.trim();
  if (v === "") return "Ismni kiriting";
  if (v.length > MAX_NAME_LENGTH) return `Ism ${MAX_NAME_LENGTH} belgidan oshmasin`;
  return null;
}

/** "+998 90 123 45 67", "998901234567", "90 123-45-67" → "+998 90 123 45 67"; null when not a valid number. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[\s()\-+]/g, "");
  const local = digits.startsWith("998") ? digits.slice(3) : digits;
  if (!/^\d{9}$/.test(local)) return null;
  return `+998 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
}

/** Same rule as the server: required, Uzbek mobile/landline format. */
export function validatePhone(raw: string): string | null {
  if (raw.replace(/[\s()\-+]/g, "") === "") return "Telefon raqamingizni kiriting";
  if (!normalizePhone(raw)) return "Telefon raqamini +998 XX XXX XX XX koʻrinishida kiriting";
  return null;
}

/** Parsed day count, or null when invalid. */
export function parseDays(raw: string): number | null {
  return validateDays(raw) === null ? Number(raw.trim()) : null;
}

export function calcTotal(days: number, pricePerDay: number): number {
  return days * pricePerDay;
}
