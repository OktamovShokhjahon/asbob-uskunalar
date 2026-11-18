"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Page-wide motion, kept in one place:
 *  - rows step in (data-rows)
 *  - rolling figures (data-roll="1234")
 *  - colour wave through a heading (data-wave)
 *  - a late word slides into its line (data-late)
 *  - the hero's block edges follow the pointer (data-hero)
 * Everything is transform / opacity / colour and is switched off for reduced motion.
 */
export function ScrollFX() {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.classList.add("js");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: Array<() => void> = [];

    /* ---- rows step in ---- */
    document.querySelectorAll<HTMLElement>("[data-rows]").forEach((list) => {
      Array.from(list.children).forEach((c, i) => (c as HTMLElement).style.setProperty("--i", String(i)));
    });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-in");
          if (e.target.hasAttribute("data-roll")) e.target.classList.add("go");
          io.unobserve(e.target);
        });
      },
      { threshold: 0.25 },
    );
    document.querySelectorAll("[data-rows], [data-steps], [data-steps-total]").forEach((el) => io.observe(el));
    cleanups.push(() => io.disconnect());

    /* ---- rolling figures ---- */
    document.querySelectorAll<HTMLElement>("[data-roll]").forEach((el) => {
      if (el.dataset.ready) return;
      el.dataset.ready = "1";
      const text = el.dataset.roll ?? "";
      const shown = el.dataset.text ?? text;
      el.setAttribute("aria-label", shown);
      el.setAttribute("role", "text");
      el.classList.add("roll");
      el.innerHTML = "";
      let c = 0;
      for (const ch of shown) {
        if (/\d/.test(ch)) {
          const col = document.createElement("span");
          col.className = "roll-col";
          col.setAttribute("aria-hidden", "true");
          const strip = document.createElement("span");
          strip.className = "roll-strip";
          strip.style.setProperty("--d", reduce ? ch : ch);
          strip.style.setProperty("--c", String(c++));
          for (let d = 0; d <= 9; d++) {
            const s = document.createElement("span");
            s.textContent = String(d);
            strip.appendChild(s);
          }
          col.appendChild(strip);
          el.appendChild(col);
        } else {
          const f = document.createElement("span");
          f.className = "roll-fixed";
          f.setAttribute("aria-hidden", "true");
          f.innerHTML = ch === " " ? "&nbsp;" : ch;
          el.appendChild(f);
        }
      }
      if (reduce) el.classList.add("go");
      else io.observe(el);
    });

    /* ---- colour wave + late word, driven by scroll ---- */
    type Wave = { el: HTMLElement; chars: HTMLElement[] };
    const waves: Wave[] = [];
    document.querySelectorAll<HTMLElement>("[data-wave]").forEach((el) => {
      if (el.dataset.ready) return;
      el.dataset.ready = "1";
      const text = el.textContent ?? "";
      el.setAttribute("aria-label", text);
      el.textContent = "";
      const chars: HTMLElement[] = [];
      text.split(/(\s+)/).forEach((part) => {
        if (/^\s+$/.test(part)) {
          el.appendChild(document.createTextNode(" "));
          return;
        }
        const w = document.createElement("span");
        w.className = "wave-w";
        w.setAttribute("aria-hidden", "true");
        for (const ch of part) {
          const s = document.createElement("span");
          s.className = "wave-ch";
          s.textContent = ch;
          w.appendChild(s);
          chars.push(s);
        }
        el.appendChild(w);
      });
      waves.push({ el, chars });
    });

    const lates: HTMLElement[] = [];
    document.querySelectorAll<HTMLElement>("[data-late]").forEach((el) => {
      const word = el.querySelector<HTMLElement>(".late-word");
      if (word) lates.push(word);
    });

    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      if (!reduce) {
        for (const { el, chars } of waves) {
          const top = el.getBoundingClientRect().top;
          // wave runs while the heading crosses 80% to 40% of the viewport
          const p = clamp((vh * 0.8 - top) / (vh * 0.4));
          const n = chars.length;
          const head = p * (n + 8);
          chars.forEach((c, i) => c.classList.toggle("on", p > 0 && p < 1 && i < head && i >= head - 8));
        }
        for (const word of lates) {
          const parent = word.closest<HTMLElement>("[data-late]")!;
          const top = parent.getBoundingClientRect().top;
          const p = ease(clamp((vh * 0.95 - top) / (vh * 0.5)));
          const from = window.innerWidth < 768 ? 64 : 96;
          word.style.transform = `translateY(${(1 - p) * from}px)`;
        }
      }
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    cleanups.push(() => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    });

    /* ---- hero: block edges drift with the pointer, up to 4% ---- */
    const hero = document.querySelector<HTMLElement>("[data-hero]");
    if (hero && !reduce && window.matchMedia("(pointer: fine) and (min-width: 768px)").matches) {
      let tx = 0;
      let ty = 0;
      let cx = 0;
      let cy = 0;
      let raf = 0;
      const loop = () => {
        cx += (tx - cx) * 0.08;
        cy += (ty - cy) * 0.08;
        hero.style.setProperty("--sx", `${62 + cx * 4}%`);
        hero.style.setProperty("--sy", `${55 + cy * 4}%`);
        raf = Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001 ? requestAnimationFrame(loop) : 0;
      };
      const onMove = (e: PointerEvent) => {
        const r = hero.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
        if (!raf) raf = requestAnimationFrame(loop);
      };
      hero.addEventListener("pointermove", onMove);
      cleanups.push(() => {
        hero.removeEventListener("pointermove", onMove);
        cancelAnimationFrame(raf);
      });
    }

    return () => cleanups.forEach((fn) => fn());
  }, [pathname]);

  return null;
}
