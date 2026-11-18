import Link from "next/link";
import { Catalog } from "@/components/Catalog";
import { HeroCalc } from "@/components/HeroCalc";

const TITLE = ["Asbobni sotib olmang,", "kunbay ijaraga oling."];

/** "How it works": a real sequence, so the steps are numbered. */
const STEPS: { title: string; rows: [string, string][] }[] = [
  { title: "Asbobni tanlang", rows: [["Javondan kartani bosing", "10 soniya"]] },
  {
    title: "Kunlarni kiriting",
    rows: [
      ["1 dan 7 gacha butun son", "10 soniya"],
      ["Kunlar × kunlik narx", "darhol"],
    ],
  },
  {
    title: "Soʻrov yuboring",
    rows: [
      ["Ismingizni yozing", "20 soniya"],
      ["«Ijara soʻrovi» tugmasi", "1 bosish"],
    ],
  },
];

function HeroTitle() {
  return (
    <>
      {TITLE.map((t, i) => (
        <span className="line" key={t} style={{ ["--i" as string]: i }}>
          {t}
        </span>
      ))}
    </>
  );
}

export default function HomePage() {
  return (
    <>
      {/* 1. Hero: three flat blocks, the headline crosses their edges */}
      <section data-hero className="hero" aria-labelledby="hero-title">
        <div className="hero-b hero-b1" />
        <div className="hero-b hero-b2" />
        <div className="hero-b hero-b3" />

        <HeroCalc />

        <div className="hero-layer ink-copy">
          <div className="hero-layer-inner">
            <h1 id="hero-title" className="hero-title">
              <HeroTitle />
            </h1>
          </div>
        </div>
        <div className="hero-layer light-copy" aria-hidden>
          <div className="hero-layer-inner">
            <p className="hero-title">
              <HeroTitle />
            </p>
          </div>
        </div>

        <div className="hero-text">
          <p className="hero-lead rise" style={{ ["--d" as string]: "1000ms" }}>
            Drel, narvon yoki proyektor bir-ikki kunga kerakmi? Kunlarni tanlang, narx shu zahoti hisoblanadi.
          </p>
          <a href="#asboblar" className="btn btn-ink rise" style={{ ["--d" as string]: "1150ms" }}>
            Asboblarni koʻrish <span className="arrow" aria-hidden>↓</span>
          </a>
        </div>
      </section>

      {/* 2. How it works: three step cards, dealt in order, joined by a track */}
      <section id="qanday" className="section scroll-mt-24">
        <div className="wrap">
          <div className="grid items-end gap-6 md:grid-cols-12">
            <h2 className="font-display text-head on-light md:col-span-7" data-wave>
              Uch qadam, bir daqiqa
            </h2>
            <p className="max-w-[34ch] text-lead md:col-span-5 md:justify-self-end">
              Garov, yetkazish va yashirin toʻlovlar yoʻq. Faqat kunlar va kunlik narx.
            </p>
          </div>

          <ol className="steps mt-14" data-steps>
            {STEPS.map((s, i) => (
              <li key={s.title} className="step-slot" style={{ ["--i" as string]: i }}>
                <article className={`step ${i === 1 ? "step-ink" : ""}`}>
                  <span className="step-num font-display" aria-hidden>
                    {i + 1}
                  </span>
                  <p className="step-kicker">{i + 1}-qadam</p>
                  <h3 className="step-title font-display">{s.title}</h3>
                  <ul className="step-rows">
                    {s.rows.map(([what, time]) => (
                      <li key={what}>
                        <span>{what}</span>
                        <span className="step-time">{time}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </li>
            ))}
          </ol>

          <p className="steps-total" data-steps-total>
            <span>Qoʻlingizda: tasdiqlangan ijara soʻrovi</span>
            <span className="font-display">jami ~1 daqiqa</span>
          </p>
        </div>
      </section>

      {/* 3. Catalog: the deck */}
      <section id="asboblar" className="section scroll-mt-24">
        <div className="wrap">
          <Catalog />
        </div>
      </section>

      {/* 4. The figures */}
      <section className="section">
        <div className="wrap">
          <h2 className="font-display text-head max-w-[18ch]">Narxda yashirin narsa yoʻq</h2>
          <ul className="mt-14 grid gap-12 md:grid-cols-3" data-rows>
            <li>
              <p className="font-display text-display">
                <span data-roll="7">7</span>
              </p>
              <p className="mt-3 max-w-[22ch] text-lead">kungacha ijaraga olish mumkin</p>
            </li>
            <li>
              <p className="font-display text-display">
                <span data-roll="0">0</span>
              </p>
              <p className="mt-3 max-w-[22ch] text-lead">soʻm garov va yetkazish haqi</p>
            </li>
            <li>
              <p className="font-display text-display">
                <span data-roll="20000" data-text="20 000">20 000</span>
              </p>
              <p className="mt-3 max-w-[22ch] text-lead">soʻmdan boshlanadigan kunlik narx</p>
            </li>
          </ul>
        </div>
      </section>

      {/* 5. Owners */}
      <section className="section">
        <div className="wrap grid items-end gap-10 md:grid-cols-12">
          <h2 className="font-display text-display md:col-span-8" data-late>
            Uyda asbobingiz bekor <span className="late-word">turibdimi?</span>
          </h2>
          <div className="md:col-span-4">
            <p className="text-lead">
              Roʻyxatdan oʻting va eʼlon bering. Superadmin tekshirgach, asbobingiz shu javonga osiladi.
            </p>
            <Link href="/royxatdan-otish" className="btn btn-ink mt-8">
              Roʻyxatdan oʻtish <span className="arrow" aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
