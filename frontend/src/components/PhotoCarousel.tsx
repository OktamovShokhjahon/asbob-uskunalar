"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { mediaUrl } from "@/lib/http";
import type { IconKind } from "@/lib/types";
import { ToolIcon } from "./ToolIcon";

type Props = {
  photos: string[];
  alt: string;
  icon: IconKind;
  /** card: compact, arrows on hover, sits under a stretched link. large: thumbnails, swipe, keys. */
  size?: "card" | "large";
  /** the surface it sits on, for the empty state */
  tone?: "ink" | "surface";
};

/**
 * Photo carousel for an eʼlon. Without photos (the six seeded tools) it shows the tool's icon.
 */
export function PhotoCarousel({ photos, alt, icon, size = "card", tone = "surface" }: Props) {
  const [index, setIndex] = useState(0);
  const start = useRef<number | null>(null);
  const count = photos.length;
  const i = Math.min(index, Math.max(0, count - 1));

  if (count === 0) {
    return (
      <div className={`car car-${size} car-empty ${tone === "ink" ? "on-ink-empty" : ""}`} aria-hidden>
        <ToolIcon kind={icon} className={size === "large" ? "h-28 w-28" : "h-16 w-16"} />
      </div>
    );
  }

  const go = (n: number) => setIndex((n + count) % count);
  const step = (d: number) => (e?: { preventDefault(): void; stopPropagation(): void }) => {
    e?.preventDefault();
    e?.stopPropagation();
    go(i + d);
  };

  function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowLeft") step(-1)(e);
    if (e.key === "ArrowRight") step(1)(e);
  }

  // swipe (large only: on cards the image is covered by the card's link)
  function onDown(e: PointerEvent) {
    start.current = e.clientX;
  }
  function onUp(e: PointerEvent) {
    if (start.current === null) return;
    const dx = e.clientX - start.current;
    start.current = null;
    if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
  }

  return (
    <div className={`car car-${size}`}>
      <div
        className="car-view"
        role="region"
        aria-roledescription="carousel"
        aria-label={`${alt}: rasmlar`}
        tabIndex={size === "large" ? 0 : undefined}
        onKeyDown={size === "large" ? onKey : undefined}
        onPointerDown={size === "large" ? onDown : undefined}
        onPointerUp={size === "large" ? onUp : undefined}
      >
        <div className="car-track" style={{ transform: `translateX(-${i * 100}%)` }}>
          {photos.map((p, n) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p + n}
              src={mediaUrl(p)}
              alt={`${alt}, ${n + 1}-rasm`}
              aria-hidden={n !== i}
              loading={n === 0 ? "eager" : "lazy"}
              draggable={false}
            />
          ))}
        </div>

        {count > 1 && (
          <>
            <span className="car-count" aria-live="polite">
              {i + 1}/{count}
            </span>
            <button type="button" className="car-btn car-prev" onClick={step(-1)} aria-label="Oldingi rasm">
              ‹
            </button>
            <button type="button" className="car-btn car-next" onClick={step(1)} aria-label="Keyingi rasm">
              ›
            </button>
            <div className="car-dots">
              {photos.map((p, n) => (
                <button
                  key={p + n}
                  type="button"
                  aria-label={`${n + 1}-rasm`}
                  aria-current={n === i}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    go(n);
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {size === "large" && count > 1 && (
        <div className="car-thumbs">
          {photos.map((p, n) => (
            <button
              key={p + n}
              type="button"
              onClick={() => go(n)}
              aria-label={`${n + 1}-rasmni koʻrsatish`}
              aria-current={n === i}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(p)} alt="" loading="lazy" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
