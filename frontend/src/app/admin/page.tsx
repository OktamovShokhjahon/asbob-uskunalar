"use client";

import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { ToolIcon } from "@/components/ToolIcon";
import { Button, LoadError, Spinner, StatusBadge, errorText, formatDate } from "@/components/ui";
import {
  adminListListings,
  adminListUsers,
  adminResetDemoData,
  adminReviewListing,
  adminStats,
} from "@/lib/api";
import { formatSom } from "@/lib/format";
import type { Listing, ListingStatus, User } from "@/lib/types";

type Tab = ListingStatus | "users";
type Stats = Awaited<ReturnType<typeof adminStats>>;

const TABS: { key: Tab; label: string; stat: keyof Stats }[] = [
  { key: "pending", label: "Tekshiruvda", stat: "pending" },
  { key: "approved", label: "Tasdiqlangan", stat: "approved" },
  { key: "rejected", label: "Rad etilgan", stat: "rejected" },
  { key: "users", label: "Foydalanuvchilar", stat: "users" },
];

function ReviewRow({ listing, onDone }: { listing: Listing; onDone: () => void }) {
  const [mode, setMode] = useState<"idle" | "rejecting">("idle");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string>();

  async function act(decision: "approve" | "reject") {
    setBusy(decision);
    setError(undefined);
    try {
      await adminReviewListing(listing.id, decision, reason);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik");
      setBusy(null);
    }
  }

  return (
    <li className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
      <div className="flex min-w-0 gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-tag/60">
          <ToolIcon kind={listing.icon} className="h-10 w-10 text-ink" />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
            <span>{listing.id}</span>
            <span>·</span>
            <span>
              {listing.ownerName} (@{listing.ownerUsername})
            </span>
            <span>·</span>
            <span>{formatDate(listing.createdAt)}</span>
          </p>
          <p className="mt-1 break-words font-display text-2xl font-bold uppercase leading-none">{listing.title}</p>
          <p className="break-words text-sm text-muted">{listing.description}</p>
          <p className="mt-1 font-semibold text-ink">{formatSom(listing.pricePerDay)} / kun</p>
          {listing.status !== "pending" && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              <StatusBadge status={listing.status} />
              {listing.reviewedAt && <span className="font-mono text-xs">{formatDate(listing.reviewedAt)}</span>}
              {listing.status === "rejected" && <span>Sabab: {listing.rejectReason ?? "koʻrsatilmagan"}</span>}
            </p>
          )}
          {error && <p className="mt-2 text-sm font-medium text-stamp">{error}</p>}
        </div>
      </div>

      {listing.status === "pending" &&
        (mode === "idle" ? (
          <div className="flex gap-2 md:flex-col">
            <Button variant="ok" busy={busy === "approve"} disabled={!!busy} onClick={() => act("approve")} className="flex-1 py-2.5">
              Tasdiqlash
            </Button>
            <Button variant="outline" disabled={!!busy} onClick={() => setMode("rejecting")} className="flex-1 py-2.5">
              Rad etish
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 md:w-72">
            <label htmlFor={`reason-${listing.id}`} className="text-sm font-semibold">
              Rad etish sababi <span className="font-normal text-muted">(ixtiyoriy)</span>
            </label>
            <input
              id={`reason-${listing.id}`}
              autoFocus
              value={reason}
              maxLength={120}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Masalan, narx notoʻgʻri koʻrsatilgan"
              className="w-full rounded-lg border-2 border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
            />
            <div className="flex gap-2">
              <Button variant="stamp" busy={busy === "reject"} onClick={() => act("reject")} className="flex-1 py-2 text-sm">
                Rad etish
              </Button>
              <Button variant="outline" disabled={!!busy} onClick={() => setMode("idle")} className="flex-1 py-2 text-sm">
                Bekor qilish
              </Button>
            </div>
          </div>
        ))}
    </li>
  );
}

function UsersTable({ users }: { users: (User & { listingCount: number })[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="border-b border-line font-mono text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="px-5 py-3 font-medium">Ism</th>
            <th className="px-5 py-3 font-medium">Foydalanuvchi nomi</th>
            <th className="px-5 py-3 font-medium">Rol</th>
            <th className="px-5 py-3 font-medium">Eʼlonlar</th>
            <th className="px-5 py-3 font-medium">Roʻyxatdan oʻtgan</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {users.map((u) => (
            <tr key={u.id}>
              <td className="px-5 py-3 font-medium">{u.fullName}</td>
              <td className="px-5 py-3 font-mono">@{u.username}</td>
              <td className="px-5 py-3">
                {u.role === "superadmin" ? (
                  <span className="rounded-full bg-ink px-2 py-0.5 font-mono text-xs text-accent">superadmin</span>
                ) : (
                  <span className="text-muted">foydalanuvchi</span>
                )}
              </td>
              <td className="px-5 py-3 font-mono">{u.listingCount}</td>
              <td className="px-5 py-3 font-mono text-xs text-muted">{formatDate(u.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminPanel() {
  const [tab, setTab] = useState<Tab>("pending");
  const [stats, setStats] = useState<Stats | null>(null);
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [users, setUsers] = useState<(User & { listingCount: number })[] | null>(null);

  const [error, setError] = useState<string>();

  const load = useCallback(async (t: Tab) => {
    setError(undefined);
    try {
      if (t === "users") {
        setUsers(null);
        const [s, u] = await Promise.all([adminStats(), adminListUsers()]);
        setStats(s);
        setUsers(u);
      } else {
        setListings(null);
        const [s, l] = await Promise.all([adminStats(), adminListListings(t)]);
        setStats(s);
        setListings(l);
      }
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  async function onReset() {
    if (
      !window.confirm(
        "Barcha foydalanuvchilar, eʼlonlar va ijara soʻrovlari oʻchiriladi, boshlangʻich 6 ta asbob qoladi. Davom etasizmi?",
      )
    )
      return;
    try {
      await adminResetDemoData();
      window.location.href = "/kirish";
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 md:py-14">
      <p className="text-sm font-semibold text-muted">Superadmin paneli</p>
      <h1 className="mt-2 font-display text-5xl font-extrabold uppercase leading-[0.9]">Eʼlonlarni tekshirish</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Foydalanuvchilar bergan har bir eʼlon shu yerda tasdiqlanadi. Tasdiqlangan eʼlon darhol katalogga chiqadi, rad
        etilgani esa egasining kabinetida sababi bilan koʻrinadi.
      </p>

      <div role="tablist" aria-label="Boʻlimlar" className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TABS.map((t) => {
          const active = tab === t.key;
          const n = stats?.[t.stat];
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={`rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                active ? "border-ink bg-ink text-paper" : "border-line bg-white hover:border-ink/40"
              }`}
            >
              <span
                className={`block font-display text-4xl font-extrabold leading-none ${
                  t.key === "pending" && n ? (active ? "text-accent" : "text-stamp") : ""
                }`}
              >
                {n ?? "·"}
              </span>
              <span className={`mt-1 block text-sm ${active ? "text-paper/80" : "text-muted"}`}>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="mt-6">
        {error ? (
          <LoadError message={error} onRetry={() => load(tab)} />
        ) : tab === "users" ? (
          users ? <UsersTable users={users} /> : <Spinner />
        ) : listings === null ? (
          <Spinner />
        ) : listings.length === 0 ? (
          <div className="pegboard rounded-xl px-6 py-14 text-center">
            <h2 className="font-display text-3xl font-bold uppercase">
              {tab === "pending" ? "Navbat boʻsh" : "Bu boʻlimda eʼlon yoʻq"}
            </h2>
            <p className="mt-2 text-muted">
              {tab === "pending" ? "Yangi eʼlonlar kelganda shu yerda paydo boʻladi." : "Boshqa boʻlimni tanlang."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
            {listings.map((l) => (
              <ReviewRow key={l.id} listing={l} onDone={() => load(tab)} />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-12 border-t border-line pt-6">
        <button type="button" onClick={onReset} className="text-sm text-muted underline underline-offset-4 hover:text-stamp">
          Demo maʼlumotlarni tozalash
        </button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return <RequireAuth role="superadmin">{() => <AdminPanel />}</RequireAuth>;
}
