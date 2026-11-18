"use client";

import { useEffect, useState } from "react";
import { groupDigits } from "@/lib/format";

const PRICE = 30000; // Drel, A01
const DAYS = [1, 2, 3, 4, 5, 6, 7];

/**
 * The hero's worked example, live: days 1–7 × the drill's daily price.
 * Counts through the days on its own until the visitor picks one;
 * stays still for reduced motion. The headline crosses between its two halves.
 */
export function HeroCalc() {
  const [days, setDays] = useState(3);
  const [auto, setAuto] = useState(true);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (!auto || hover) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setDays((d) => (d % 7) + 1), 1800);
    return () => clearInterval(t);
  }, [auto, hover]);

  const pick = (d: number) => {
    setAuto(false);
    setDays(d);
  };

  const total = groupDigits(days * PRICE);

  return (
    <>
      <div
        className="hero-calc-top on-ink rise"
        style={{ ["--d" as string]: "1100ms" }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <p className="hero-calc-label">Narx qanday hisoblanadi</p>
        <div className="hero-calc-days" role="group" aria-label="Kunlar sonini tanlang">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={d === days}
              aria-label={`${d} kun`}
              onClick={() => pick(d)}
              className={d <= days ? "on" : undefined}
            >
              {d}
            </button>
          ))}
        </div>
        <p className="hero-calc-line font-display">
          <span key={days} className="hero-calc-tick">
            {days}
          </span>{" "}
          kun <span className="opacity-60">×</span> 30 000
        </p>
        {/* phones: the total sits right here, the bottom half is hidden */}
        <p className="hero-calc-result-sm font-display md:hidden">
          = <span key={days} className="hero-calc-tick">{total}</span> soʻm
        </p>
      </div>

      <div
        className="hero-calc-bottom on-ink rise hidden md:block"
        style={{ ["--d" as string]: "1250ms" }}
      >
        <p className="hero-calc-result font-display">
          = <span key={days} className="hero-calc-tick">{total}</span>
          <span className="hero-calc-unit"> soʻm</span>
        </p>
        <p className="hero-calc-desc">
          Drel misolida: kuniga 30 000 soʻm. Garov, yetkazish va yashirin toʻlov yoʻq, jami faqat kunlar va kunlik
          narxdan iborat.
        </p>
      </div>
    </>
  );
}
