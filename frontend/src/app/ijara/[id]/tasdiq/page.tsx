"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ToolIcon } from "@/components/ToolIcon";
import { LoadError, Spinner, errorText } from "@/components/ui";
import { getPublicListing, getRentalRequest, type RentalRequest } from "@/lib/api";
import { formatSom } from "@/lib/format";
import type { Listing } from "@/lib/types";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "missing" }
  | { kind: "ok"; rental: RentalRequest; listing: Listing | null };

function ConfirmView() {
  const { id } = useParams<{ id: string }>();
  const rentalId = useSearchParams().get("r");
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!rentalId) {
      setState({ kind: "missing" });
      return;
    }
    setState({ kind: "loading" });
    Promise.all([getRentalRequest(rentalId), getPublicListing(id).catch(() => null)])
      .then(([rental, listing]) => {
        if (!alive) return;
        // The request must exist and belong to this tool.
        if (!rental || rental.toolId !== id.toUpperCase()) setState({ kind: "missing" });
        else setState({ kind: "ok", rental, listing });
      })
      .catch((e) => alive && setState({ kind: "error", message: errorText(e) }));
    return () => {
      alive = false;
    };
  }, [id, rentalId, attempt]);

  if (state.kind === "loading") return <Spinner />;
  if (state.kind === "error")
    return (
      <div className="px-4 py-16">
        <LoadError message={state.message} onRetry={() => setAttempt((n) => n + 1)} />
      </div>
    );

  if (state.kind === "missing") {
    return (
      <div className="pegboard px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-md rounded-xl border-2 border-stamp bg-paper p-7">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-stamp">Soʻrov topilmadi</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold uppercase leading-none">Bunday soʻrov yoʻq</h1>
          <p className="mt-3 text-muted">Ijara soʻrovini shakl orqali yuboring — tasdiq shu yerda chiqadi.</p>
          <Link
            href={`/ijara/${id}`}
            className="mt-7 btn btn-ink"
          >
            Shaklga qaytish
          </Link>
        </div>
      </div>
    );
  }

  const { rental, listing } = state;
  const rows: [string, string][] = [
    ["Asbob", rental.toolName],
    ["Kunlik narx", formatSom(rental.pricePerDay)],
    ["Kunlar soni", `${rental.days} kun`],
    ["Ism", rental.customerName],
  ];

  return (
    <div className="pegboard px-4 py-12 sm:px-6 md:py-16">
      <div className="mx-auto max-w-md">
        <div className="hang-in drop-shadow-[0_14px_22px_rgb(23_38_58/0.18)]">
          <article className="receipt px-7 pb-12 pt-8" aria-labelledby="confirm-title">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Ijara soʻrovi · {rental.toolId}</p>
                <h1 id="confirm-title" className="mt-2 font-display text-4xl font-extrabold uppercase leading-[0.9]">
                  Soʻrov tasdiqlandi
                </h1>
              </div>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ok text-white" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={3}>
                  <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>

            {listing && (
              <div className="mt-6 flex items-center gap-3 rounded-lg bg-tag/40 p-3">
                <ToolIcon kind={listing.icon} className="h-10 w-10 text-ink" />
                <p className="text-sm text-muted">{listing.description}</p>
              </div>
            )}

            <dl className="mt-6 space-y-3">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-2">
                  <dt className="text-muted">{k}</dt>
                  <span className="leader" aria-hidden />
                  <dd className="max-w-[60%] break-words text-right font-mono font-semibold">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 flex items-center justify-between gap-4 border-t-2 border-ink pt-5">
              <span className="font-display text-2xl font-bold uppercase">Jami</span>
              <span className="stamp text-2xl">{formatSom(rental.total)}</span>
            </div>

            <p className="mt-6 font-mono text-xs text-muted">Soʻrov raqami: {rental.id}</p>
            <p className="mt-2 text-sm text-muted">
              Bu sinov loyihasi: haqiqiy ijara yoki toʻlov amalga oshirilmaydi, hech qanday xabar yuborilmaydi.
            </p>
          </article>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/#asboblar"
            className="btn btn-ink flex-1"
          >
            Katalogga qaytish
          </Link>
          <Link
            href={`/ijara/${rental.toolId}?kun=${rental.days}`}
            className="btn flex-1"
          >
            Muddatni oʻzgartirish
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ConfirmView />
    </Suspense>
  );
}
