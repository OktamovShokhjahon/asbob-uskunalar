"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, createRentalRequest, type RentalRequest } from "@/lib/api";
import { formatSom, groupDigits } from "@/lib/format";
import { Button, FormError } from "./ui";
import {
  MAX_DAYS,
  MAX_NAME_LENGTH,
  calcTotal,
  normalizePhone,
  parseDays,
  validateDays,
  validateName,
  validatePhone,
} from "@/lib/rental";
import type { Listing } from "@/lib/types";

type Errors = { days?: string | null; name?: string | null; phone?: string | null };

type Props = { tool: Listing; initialDays?: string; initialName?: string };

export function RentalForm({ tool, initialDays = "1", initialName = "" }: Props) {
  const router = useRouter();
  const [daysRaw, setDaysRaw] = useState(initialDays);
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const phoneRef = useRef<HTMLInputElement>(null);
  const [done, setDone] = useState<RentalRequest | null>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  // Bring the success message into view and to screen readers' attention.
  useEffect(() => {
    if (!done) return;
    doneRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    doneRef.current?.focus({ preventScroll: true });
  }, [done]);

  function again() {
    setDone(null);
    setTriedSubmit(false);
    setErrors({});
  }

  const successView = done && (
      <div ref={doneRef} tabIndex={-1} role="status" className="rent-ok">
        <div className="flex items-start gap-4">
          <span className="rent-ok-check" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={3}>
              <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="font-display text-sub">Soʻrovingiz yuborildi</p>
            <p className="mt-2 text-muted">
              Asbob egasi <strong className="text-ink">{done.customerPhone ?? normalizePhone(phone)}</strong> raqamiga
              qoʻngʻiroq qilib, kelishib oladi.
            </p>
          </div>
        </div>

        <dl className="rent-ok-rows">
          <div>
            <dt>Asbob</dt>
            <dd>{done.toolName}</dd>
          </div>
          <div>
            <dt>Kunlar soni</dt>
            <dd>{done.days} kun</dd>
          </div>
          <div>
            <dt>Ism</dt>
            <dd>{done.customerName}</dd>
          </div>
          <div>
            <dt>Jami</dt>
            <dd className="font-display text-sub">{formatSom(done.total)}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/ijara/${done.toolId}/tasdiq?r=${encodeURIComponent(done.id)}`}
            className="btn btn-ink flex-1"
          >
            Tasdiqni ochish <span className="arrow" aria-hidden>→</span>
          </Link>
          <button type="button" onClick={again} className="btn flex-1">
            Yana soʻrov yuborish
          </button>
        </div>
        <p className="mt-4 text-xs text-muted">Soʻrov raqami: {done.id}</p>
      </div>
  );
  const [errors, setErrors] = useState<Errors>({});
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string>();
  const daysRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const days = parseDays(daysRaw);
  const total = days !== null ? calcTotal(days, tool.pricePerDay) : null;

  function updateDays(value: string) {
    setDaysRaw(value);
    if (triedSubmit) setErrors((e) => ({ ...e, days: validateDays(value) }));
  }

  function updateName(value: string) {
    setName(value);
    if (triedSubmit) setErrors((e) => ({ ...e, name: validateName(value) }));
  }

  function updatePhone(value: string) {
    setPhone(value);
    if (triedSubmit) setErrors((e) => ({ ...e, phone: validatePhone(value) }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setFormError(undefined);
    const next: Errors = { days: validateDays(daysRaw), name: validateName(name), phone: validatePhone(phone) };
    setErrors(next);
    setTriedSubmit(true);

    if (next.days) return daysRef.current?.focus();
    if (next.name) return nameRef.current?.focus();
    if (next.phone) return phoneRef.current?.focus();

    setBusy(true);
    try {
      const rental = await createRentalRequest(
        { toolId: tool.id, days: days!, customerName: name.trim(), customerPhone: normalizePhone(phone)! },
        crypto.randomUUID(),
      );
      // Success shows right here, at once; the full receipt is one click away.
      setDone(rental);
      setBusy(false);
      router.prefetch(`/ijara/${tool.id}/tasdiq?r=${encodeURIComponent(rental.id)}`);
    } catch (err) {
      // Server-side validation mirrors ours; show its messages on the matching fields.
      const f = err instanceof ApiError ? err.fields : undefined;
      if (f && (f.days || f.customerName || f.customerPhone)) {
        setErrors({ days: f.days ?? null, name: f.customerName ?? null, phone: f.customerPhone ?? null });
      } else {
        setFormError(err instanceof Error ? err.message : "Kutilmagan xatolik");
      }
      setBusy(false);
    }
  }

  // After every hook: show the success message instead of the form.
  if (successView) return successView;

  const inputBase =
    "w-full rounded-[4px] border-2 bg-white px-4 py-3 text-lg outline-none transition-colors focus:border-ink";

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-7">
      {/* Days */}
      <div>
        <label htmlFor="days" className="block font-semibold">
          Kunlar soni
        </label>
        <p id="days-hint" className="mt-0.5 text-sm text-muted">
          1 dan {MAX_DAYS} gacha butun son
        </p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={daysRef}
            id="days"
            name="days"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={daysRaw}
            onChange={(e) => updateDays(e.target.value)}
            aria-invalid={errors.days ? true : undefined}
            aria-describedby={errors.days ? "days-hint days-error" : "days-hint"}
            className={`${inputBase} font-mono sm:w-28 ${errors.days ? "border-stamp" : "border-line"}`}
          />

          {/* Week strip: quick pick, fills up to the chosen day */}
          <div role="group" aria-label="Kunlar sonini tez tanlash" className="flex flex-1 gap-1.5">
            {Array.from({ length: MAX_DAYS }, (_, i) => i + 1).map((d) => {
              const filled = days !== null && d <= days;
              const current = days === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => updateDays(String(d))}
                  aria-pressed={current}
                  aria-label={`${d} kun`}
                  className={`h-12 flex-1 rounded-md border-2 font-mono text-sm font-semibold transition-colors ${
                    filled
                      ? "border-ink bg-ink text-accent"
                      : "border-line bg-white text-muted hover:border-ink/40 hover:text-ink"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {errors.days && (
          <p id="days-error" role="alert" className="mt-2 text-sm font-medium text-stamp">
            {errors.days}
          </p>
        )}
      </div>

      {/* Name */}
      <div>
        <label htmlFor="name" className="block font-semibold">
          Ismingiz <span className="text-stamp">*</span>
        </label>
        <input
          ref={nameRef}
          id="name"
          name="name"
          type="text"
          autoComplete="given-name"
          maxLength={MAX_NAME_LENGTH + 10}
          placeholder="Masalan, Dilnoza"
          value={name}
          onChange={(e) => updateName(e.target.value)}
          aria-required
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "name-error" : undefined}
          className={`${inputBase} mt-3 ${errors.name ? "border-stamp" : "border-line"}`}
        />
        {errors.name && (
          <p id="name-error" role="alert" className="mt-2 text-sm font-medium text-stamp">
            {errors.name}
          </p>
        )}
      </div>

      {/* Phone: the owner calls back on this number */}
      <div>
        <label htmlFor="phone" className="block font-semibold">
          Telefon raqamingiz <span className="text-stamp">*</span>
        </label>
        <p id="phone-hint" className="mt-0.5 text-sm text-muted">
          Asbob egasi shu raqamga qoʻngʻiroq qiladi. Roʻyxatdan oʻtish shart emas.
        </p>
        <input
          ref={phoneRef}
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={20}
          placeholder="+998 90 123 45 67"
          value={phone}
          onChange={(e) => updatePhone(e.target.value)}
          onBlur={() => {
            const p = normalizePhone(phone);
            if (p) setPhone(p);
          }}
          aria-required
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={errors.phone ? "phone-hint phone-error" : "phone-hint"}
          className={`${inputBase} mt-3 font-mono ${errors.phone ? "border-stamp" : "border-line"}`}
        />
        {errors.phone && (
          <p id="phone-error" role="alert" className="mt-2 text-sm font-medium text-stamp">
            {errors.phone}
          </p>
        )}
      </div>

      {/* Total */}
      <div className="rounded-[4px] bg-wall p-6">
        <div className="flex items-baseline gap-3 font-mono text-sm text-muted">
          <span>{days !== null ? `${days} kun` : "— kun"}</span>
          <span>×</span>
          <span>{groupDigits(tool.pricePerDay)}</span>
          <span className="leader" />
        </div>
        <p className="mt-3 flex items-baseline justify-between gap-4">
          <span className="font-display text-sub">Jami</span>
          <output htmlFor="days" aria-live="polite" className="font-mono text-3xl font-semibold text-ink">
            {total !== null ? formatSom(total) : "—"}
          </output>
        </p>
      </div>

      <FormError message={formError} />

      <Button type="submit" busy={busy} className="w-full py-4 text-lg">
        Ijara soʻrovi
      </Button>
    </form>
  );
}
