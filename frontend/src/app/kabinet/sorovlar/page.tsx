"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { KabinetTabs } from "@/components/KabinetTabs";
import { RequireAuth } from "@/components/RequireAuth";
import { LoadError, Spinner, errorText, formatDate } from "@/components/ui";
import { listRequestsForMyListings, type RentalRequest } from "@/lib/api";
import { formatSom } from "@/lib/format";
import type { User } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** "+998 90 123 45 67" → "tel:+998901234567" */
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

function RequestCard({ r }: { r: RentalRequest }) {
  const [copied, setCopied] = useState(false);
  const isNew = Date.now() - new Date(r.createdAt).getTime() < DAY_MS;

  async function copy() {
    if (!r.customerPhone) return;
    try {
      await navigator.clipboard.writeText(r.customerPhone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the tel: link still works */
    }
  }

  return (
    <li className="req-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <Link href={`/ijara/${r.toolId}`} className="font-semibold text-ink hover:underline">
              {r.toolName}
            </Link>
            <span>· {r.toolId}</span>
            {isNew && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-ink">Yangi</span>}
          </p>
          <p className="mt-2 font-display text-sub">{r.customerName}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-sub">{formatSom(r.total)}</p>
          <p className="text-sm text-muted">
            {r.days} kun × {formatSom(r.pricePerDay)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {r.customerPhone ? (
          <div className="flex flex-wrap items-center gap-2">
            <a href={telHref(r.customerPhone)} className="btn btn-ink btn-sm">
              <span aria-hidden>☎</span> {r.customerPhone}
            </a>
            <button type="button" onClick={copy} className="btn btn-sm" aria-live="polite">
              {copied ? "Nusxalandi" : "Nusxalash"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted">Telefon raqami koʻrsatilmagan (eski soʻrov)</p>
        )}
        <p className="text-sm text-muted">
          {r.startDate && r.endDate ? `${r.startDate} – ${r.endDate} · ` : ""}
          {formatDate(r.createdAt)}
        </p>
      </div>
    </li>
  );
}

function Requests({ user }: { user: User }) {
  const [items, setItems] = useState<RentalRequest[] | null>(null);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [tool, setTool] = useState("all");

  useEffect(() => {
    setError(undefined);
    listRequestsForMyListings()
      .then(setItems)
      .catch((e) => setError(errorText(e)));
  }, [attempt]);

  // Tools that have requests, for the filter.
  const tools = useMemo(() => {
    const m = new Map<string, string>();
    items?.forEach((r) => m.set(r.toolId, r.toolName));
    return [...m.entries()];
  }, [items]);

  const shown = useMemo(() => (items ?? []).filter((r) => tool === "all" || r.toolId === tool), [items, tool]);
  const totalValue = shown.reduce((s, r) => s + r.total, 0);
  const lastWeek = shown.filter((r) => Date.now() - new Date(r.createdAt).getTime() < 7 * DAY_MS).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 md:py-14">
      <p className="text-sm font-semibold text-muted">
        Kabinet · @{user.username}
        {user.role === "superadmin" && " · superadmin"}
      </p>
      <h1 className="mt-2 font-display text-head">Soʻrovlar</h1>
      <p className="mt-3 max-w-xl text-muted">
        Eʼlonlaringiz uchun yuborilgan ijara soʻrovlari. Mijozga telefon orqali bogʻlanib, kelishib oling.
      </p>

      <KabinetTabs requestCount={items?.length} />

      <div className="mt-8">
        {error ? (
          <LoadError message={error} onRetry={() => setAttempt((n) => n + 1)} />
        ) : items === null ? (
          <Spinner />
        ) : items.length === 0 ? (
          <div className="rounded-[4px] bg-wall px-6 py-14 text-center">
            <h2 className="font-display text-sub">Hali soʻrov yoʻq</h2>
            <p className="mx-auto mt-2 max-w-sm text-muted">
              Eʼloningiz katalogda turibdi. Kimdir «Ijara soʻrovi»ni yuborsa, u shu yerda telefon raqami bilan paydo
              boʻladi.
            </p>
            <Link href="/kabinet" className="btn btn-ink mt-6">
              Eʼlonlarimga qaytish
            </Link>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="req-stat">
                <p className="font-display text-head">{shown.length}</p>
                <p className="text-sm text-muted">ta soʻrov</p>
              </div>
              <div className="req-stat">
                <p className="font-display text-head">{lastWeek}</p>
                <p className="text-sm text-muted">soʻnggi 7 kunda</p>
              </div>
              <div className="req-stat">
                <p className="font-display text-sub leading-tight">{formatSom(totalValue)}</p>
                <p className="text-sm text-muted">jami qiymat</p>
              </div>
            </div>

            {tools.length > 1 && (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <label htmlFor="tool-filter" className="font-semibold">
                  Eʼlon
                </label>
                <select
                  id="tool-filter"
                  value={tool}
                  onChange={(e) => setTool(e.target.value)}
                  className="rounded-[4px] border-2 border-line bg-white px-3 py-2 outline-none focus:border-ink"
                >
                  <option value="all">Hammasi</option>
                  {tools.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name} ({id})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <ul className="mt-6 grid gap-4">
              {shown.map((r) => (
                <RequestCard key={r.id} r={r} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

export default function RequestsPage() {
  return <RequireAuth>{(user) => <Requests user={user} />}</RequireAuth>;
}
