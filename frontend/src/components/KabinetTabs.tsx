"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/kabinet", label: "Eʼlonlarim" },
  { href: "/kabinet/sorovlar", label: "Soʻrovlar" },
];

/** Section switch inside the cabinet. */
export function KabinetTabs({ requestCount }: { requestCount?: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Kabinet boʻlimlari" className="mt-8 flex gap-2 border-b-2 border-line">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-[2px] inline-flex items-center gap-2 border-b-2 px-4 py-3 font-semibold transition-colors ${
              active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
            {t.href === "/kabinet/sorovlar" && requestCount !== undefined && requestCount > 0 && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-ink">{requestCount}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
