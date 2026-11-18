"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { KabinetTabs } from "@/components/KabinetTabs";
import { RequireAuth } from "@/components/RequireAuth";
import { ToolIcon } from "@/components/ToolIcon";
import { LoadError, Spinner, StatusBadge, errorText, formatDate } from "@/components/ui";
import { listMyListings } from "@/lib/api";
import { formatSom } from "@/lib/format";
import type { Listing, User } from "@/lib/types";

function Cabinet({ user }: { user: User }) {
  const [items, setItems] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setError(undefined);
    listMyListings()
      .then(setItems)
      .catch((e) => setError(errorText(e)));
  }, [attempt]);

  const count = (s: Listing["status"]) => items?.filter((l) => l.status === s).length ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-muted">
            Kabinet · @{user.username}
            {user.role === "superadmin" && " · superadmin"}
          </p>
          <h1 className="mt-2 font-display text-5xl font-extrabold uppercase leading-[0.9]">Mening eʼlonlarim</h1>
        </div>
        <Link
          href="/elon-berish"
          className="btn btn-ink"
        >
          + Yangi eʼlon
        </Link>
      </div>

      <KabinetTabs />

      {items && items.length > 0 && (
        <p className="mt-6 font-mono text-sm text-muted">
          {count("pending")} tekshiruvda · {count("approved")} tasdiqlangan · {count("rejected")} rad etilgan
        </p>
      )}

      <div className="mt-8">
        {error ? (
          <LoadError message={error} onRetry={() => setAttempt((n) => n + 1)} />
        ) : items === null ? (
          <Spinner />
        ) : items.length === 0 ? (
          <div className="pegboard rounded-xl px-6 py-14 text-center">
            <h2 className="font-display text-3xl font-bold uppercase">Hali eʼlon bermagansiz</h2>
            <p className="mx-auto mt-2 max-w-sm text-muted">
              Uyda kam ishlatiladigan asbob bormi? Uni kunbay ijaraga qoʻying — eʼlon tasdiqlangach katalogga chiqadi.
            </p>
            <Link
              href="/elon-berish"
              className="mt-6 inline-flex btn btn-ink"
            >
              Birinchi eʼlonni berish
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
            {items.map((l) => (
              <li key={l.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-tag/60">
                    <ToolIcon kind={l.icon} className="h-9 w-9 text-ink" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted">{l.id}</span>
                      <StatusBadge status={l.status} />
                    </p>
                    <p className="mt-1 truncate font-display text-2xl font-bold uppercase leading-none">{l.title}</p>
                    <p className="truncate text-sm text-muted">{l.description}</p>
                    {l.status === "rejected" && (
                      <p className="mt-1 text-sm text-stamp">
                        Sabab: {l.rejectReason ?? "koʻrsatilmagan"}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                  <span className="font-semibold text-ink">{formatSom(l.pricePerDay)}</span>
                  {l.status === "approved" ? (
                    <Link href={`/ijara/${l.id}`} className="text-sm font-semibold underline decoration-ink decoration-2 underline-offset-4">
                      Katalogda koʻrish
                    </Link>
                  ) : (
                    <span className="font-mono text-xs text-muted">{formatDate(l.createdAt)}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function CabinetPage() {
  return <RequireAuth>{(user) => <Cabinet user={user} />}</RequireAuth>;
}
