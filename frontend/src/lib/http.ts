"use client";

/**
 * Thin fetch wrapper for the backend API (backend/ · Express, /api/v1).
 * - Unwraps the `{ data }` envelope.
 * - Turns `{ error: { code, message, fields } }` into ApiError with Uzbek messages.
 * - Sends the session token as `Authorization: Bearer …`.
 */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "");

/** Origin of the API server; uploaded images are served from it at /uploads/<file>. */
export const API_ORIGIN = new URL(API_URL).origin;

/** "/uploads/abc.jpg" → "http://localhost:4000/uploads/abc.jpg"; blob:/data:/absolute URLs pass through. */
export function mediaUrl(src: string): string {
  return src.startsWith("/") ? `${API_ORIGIN}${src}` : src;
}

const TOKEN_KEY = "ijara-token";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    /** field name → Uzbek message */
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked: session lasts for this page only */
  }
}

type ErrorBody = {
  error?: { code?: string; message?: string; fields?: Record<string, { message?: string }> };
};

type Options = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** A plain object is sent as JSON; FormData as multipart (the browser sets the boundary). */
  body?: unknown;
  headers?: Record<string, string>;
};

export async function request<T>(path: string, { method = "GET", body, headers = {} }: Options = {}): Promise<T> {
  const token = getToken();
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Serverga ulanib boʻlmadi. Internetni tekshirib, qayta urinib koʻring.", 0, "NETWORK_ERROR");
  }

  if (res.status === 204) return undefined as T;

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* empty or non-JSON body */
  }

  if (!res.ok) {
    const err = (json as ErrorBody | null)?.error;
    const fields = err?.fields
      ? Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k, v?.message ?? "Notoʻgʻri qiymat"]))
      : undefined;
    // A dead/expired session: forget the token so the UI shows "logged out".
    if (res.status === 401 && token) setToken(null);
    throw new ApiError(err?.message ?? "Serverda xatolik yuz berdi", res.status, err?.code ?? "HTTP_" + res.status, fields);
  }

  return (json as { data: T }).data;
}
