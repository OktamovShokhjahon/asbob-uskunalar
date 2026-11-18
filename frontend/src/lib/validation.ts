export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export const PRICE_MIN = 1000;
export const PRICE_MAX = 10_000_000;

export function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase();
}

export function validateRegister(input: { fullName: string; username: string; password: string; password2: string }) {
  const e: FieldErrors<"fullName" | "username" | "password" | "password2"> = {};
  const fullName = input.fullName.trim();
  if (!fullName) e.fullName = "Ismingizni kiriting";
  else if (fullName.length < 2 || fullName.length > 50) e.fullName = "Ism 2–50 belgidan iborat boʻlsin";

  const username = normalizeUsername(input.username);
  if (!username) e.username = "Foydalanuvchi nomini kiriting";
  else if (!/^[a-z0-9_]{3,20}$/.test(username))
    e.username = "3–20 ta lotin harfi, raqam yoki _ belgisi boʻlsin";

  if (!input.password) e.password = "Parolni kiriting";
  else if (input.password.length < 6) e.password = "Parol kamida 6 belgidan iborat boʻlsin";

  if (!input.password2) e.password2 = "Parolni takrorlang";
  else if (input.password2 !== input.password) e.password2 = "Parollar mos kelmadi";
  return e;
}

export function validateLogin(input: { username: string; password: string }) {
  const e: FieldErrors<"username" | "password"> = {};
  if (!input.username.trim()) e.username = "Foydalanuvchi nomini kiriting";
  if (!input.password) e.password = "Parolni kiriting";
  return e;
}

/** "25 000" / "25000" -> 25000, or null when not a whole number. */
export function parsePrice(raw: string): number | null {
  const v = raw.replace(/\s/g, "");
  return /^\d+$/.test(v) ? Number(v) : null;
}

export function validateListing(input: { title: string; description: string; price: string }) {
  const e: FieldErrors<"title" | "description" | "price"> = {};
  const title = input.title.trim();
  if (!title) e.title = "Asbob nomini kiriting";
  else if (title.length < 2 || title.length > 40) e.title = "Nom 2–40 belgidan iborat boʻlsin";

  const description = input.description.trim();
  if (!description) e.description = "Qisqa tavsif yozing";
  else if (description.length < 5 || description.length > 80) e.description = "Tavsif 5–80 belgidan iborat boʻlsin";

  const price = parsePrice(input.price);
  if (!input.price.trim()) e.price = "Kunlik narxni kiriting";
  else if (price === null) e.price = "Narx butun son boʻlsin";
  else if (price < PRICE_MIN || price > PRICE_MAX) e.price = "Narx 1 000 dan 10 000 000 soʻmgacha boʻlsin";
  return e;
}

export function hasErrors(e: object) {
  return Object.values(e).some(Boolean);
}
