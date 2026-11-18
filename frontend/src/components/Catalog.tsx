"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { listApprovedListings } from "@/lib/api";
import type { Listing } from "@/lib/types";
import { ToolTag } from "./ToolTag";
import { LoadError, errorText } from "./ui";

const TILTS = [-2.5, 1.5, -1, 2, -1.5, 1];

export function Catalog() {
  const [items, setItems] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const deckRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setError(undefined);
    listApprovedListings()
      .then(setItems)
      .catch((e) => setError(errorText(e)));
  }, [attempt]);

  const shown = useMemo(() => {
    if (!items) return null;
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((t) => `${t.title} ${t.description}`.toLowerCase().includes(q));
  }, [items, query]);

  // The deal: cards fly from one squared pile (the middle of the deck) to their places, once.
  useEffect(() => {
    const deck = deckRef.current;
    if (!deck || !items || deck.classList.contains("dealt")) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cards = Array.from(deck.querySelectorAll<HTMLElement>(".deal"));
    const run = () => {
      const box = deck.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + Math.min(box.height / 2, 220);
      cards.forEach((c) => {
        const r = c.getBoundingClientRect();
        c.style.setProperty("--fx", `${cx - (r.left + r.width / 2)}px`);
        c.style.setProperty("--fy", `${cy - (r.top + r.height / 2)}px`);
      });
      deck.classList.add("dealt");
    };
    if (reduce) {
      deck.classList.add("dealt");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(deck);
    return () => io.disconnect();
  }, [items]);

  if (error) {
    return <LoadError message={error} onRetry={() => setAttempt((n) => n + 1)} />;
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h2 className="font-display text-display">Javondagi asboblar</h2>
          <p className="mt-4 max-w-xl text-lead">Kartani bosing, ijara shakli ochiladi.</p>
        </div>
        <div className="w-full sm:w-80">
          <label htmlFor="qidiruv" className="block font-semibold">
            Asbob qidirish
          </label>
          <input
            id="qidiruv"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Masalan, drel"
            autoComplete="off"
            className="mt-2 w-full rounded-[4px] border-2 border-line bg-white px-4 py-3 text-base outline-none transition-colors focus:border-ink"
          />
          <p className="mt-2 text-small text-muted" aria-live="polite">
            {shown ? `${shown.length} ta asbob` : "Yuklanmoqda…"}
          </p>
        </div>
      </div>

      {shown && shown.length === 0 ? (
        <p className="mt-14 text-lead">«{query}» boʻyicha hech narsa topilmadi.</p>
      ) : (
        <ul ref={deckRef} className="deck mt-12" aria-busy={!shown}>
          {shown === null
            ? Array.from({ length: 6 }, (_, i) => (
                <li key={i} aria-hidden>
                  <div className="card min-h-[260px] animate-pulse opacity-60" />
                </li>
              ))
            : shown.map((tool, i) => (
                <li key={tool.id}>
                  <ToolTag
                    tool={tool}
                    href={`/ijara/${tool.id}`}
                    tilt={TILTS[i % TILTS.length]}
                    tone={i % 2 === 0 ? "ink" : "surface"}
                    index={i}
                  />
                </li>
              ))}
        </ul>
      )}
    </>
  );
}
