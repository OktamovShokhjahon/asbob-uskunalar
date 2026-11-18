import type { ButtonHTMLAttributes, ReactNode } from "react";
import { STATUS_LABEL, type ListingStatus } from "@/lib/types";

export function inputClass(error?: string) {
  return `w-full rounded-[4px] border-2 bg-white px-4 py-3 text-base outline-none transition-colors focus:border-ink ${
    error ? "border-stamp" : "border-line"
  }`;
}

export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block font-semibold">
        {label} {required && <span className="text-stamp">*</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-0.5 text-sm text-muted">
          {hint}
        </p>
      )}
      <div className="mt-2">{children}</div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-medium text-stamp">
          {error}
        </p>
      )}
    </div>
  );
}

/** aria props wiring an input to its hint / error text. */
export function describedBy(id: string, error?: string, hint?: boolean) {
  const ids = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ");
  return { "aria-invalid": error ? true : undefined, "aria-describedby": ids || undefined };
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "stamp" | "ink" | "outline" | "ok";
  busy?: boolean;
};

const VARIANTS = {
  stamp: "btn-ink",
  ink: "btn-ink",
  outline: "",
  ok: "btn-ink",
};

export function Button({ variant = "stamp", busy, className = "", children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`btn ${VARIANTS[variant]} ${className}`}
    >
      {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      {children}
    </button>
  );
}

const STATUS_STYLE: Record<ListingStatus, string> = {
  pending: "bg-tag text-ink border-tag-edge",
  approved: "bg-ok/10 text-ok border-ok/40",
  rejected: "bg-stamp/10 text-stamp border-stamp/40",
};

export function StatusBadge({ status }: { status: ListingStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider ${STATUS_STYLE[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border-2 border-stamp/40 bg-stamp/10 px-4 py-3 text-sm font-medium text-stamp">
      {message}
    </p>
  );
}

/** Shown when data could not be loaded (e.g. the API is down). */
export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-md rounded-xl border-2 border-stamp/40 bg-paper px-6 py-8 text-center">
      <p className="font-display text-sub">Maʼlumot yuklanmadi</p>
      <p className="mt-2 text-sm text-muted">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 btn btn-ink"
        >
          Qayta urinish
        </button>
      )}
    </div>
  );
}

export function errorText(e: unknown) {
  return e instanceof Error ? e.message : "Kutilmagan xatolik";
}

export function Spinner({ label = "Yuklanmoqda…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
      {label}
    </div>
  );
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
