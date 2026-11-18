"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";

function NavLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) {
  const active = usePathname() === href;
  return (
    <Link href={href} onClick={onClick} aria-current={active ? "page" : undefined} className="nav-link">
      {children}
    </Link>
  );
}

export function SiteHeader() {
  const { user, ready, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  async function onLogout() {
    await logout();
    setOpen(false);
    router.push("/");
  }

  const close = () => setOpen(false);

  const links = (
    <>
      <NavLink href="/#asboblar" onClick={close}>
        Asboblar
      </NavLink>
      <NavLink href="/#qanday" onClick={close}>
        Qanday ishlaydi
      </NavLink>
      {ready && user?.role === "superadmin" && (
        <NavLink href="/admin" onClick={close}>
          Admin
        </NavLink>
      )}
      {ready && user && (
        <NavLink href="/kabinet" onClick={close}>
          Kabinet
        </NavLink>
      )}
      {ready && !user && (
        <NavLink href="/kirish" onClick={close}>
          Kirish
        </NavLink>
      )}
      {ready && user && (
        <button type="button" onClick={onLogout} className="nav-link text-left">
          Chiqish
        </button>
      )}
    </>
  );

  return (
    <header className="nav">
      <div className="nav-bar">
        <Link href="/" className="mark font-display text-xl" aria-label="Asbob-uskunalar ijarasi, bosh sahifa">
          <span className="mark-dot" aria-hidden />
          Asbob ijara
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Asosiy">
          {links}
          <Link href="/elon-berish" className="btn btn-ink btn-sm ml-2">
            Eʼlon berish
          </Link>
        </nav>

        <button
          type="button"
          className="btn btn-sm md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Yopish" : "Menu"}
        </button>
      </div>

      {open && (
        <nav id="mobile-menu" className="nav-menu flex flex-col gap-1 md:hidden" aria-label="Asosiy">
          {links}
          <Link href="/elon-berish" onClick={close} className="btn btn-ink btn-sm mt-2">
            Eʼlon berish
          </Link>
        </nav>
      )}
    </header>
  );
}

const EMAIL = "salom@asbob-ijarasi.example";

export function SiteFooter() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be blocked; the mailto link still works */
    }
  }

  return (
    <footer className="footer on-ink">
      <div className="wrap grid gap-12 pt-[calc(var(--section-gap)/2)] md:grid-cols-2">
        <h2 className="font-display text-head">Savol bormi? Yozing.</h2>
        <div>
          <a href={`mailto:${EMAIL}`} className="link-u font-display text-sub break-all">
            {EMAIL}
          </a>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button type="button" onClick={copy} className="btn btn-on-ink btn-sm" aria-live="polite">
              {copied ? "Nusxalandi" : "Nusxalash"}
            </button>
            <p className="text-lead">Bogʻot tumani, Xorazm</p>
          </div>
        </div>
      </div>

      <div className="wrap flex flex-col gap-6 pb-10 pt-16 text-base md:flex-row md:items-end md:justify-between">
        <nav aria-label="Pastki" className="flex flex-wrap gap-x-8 gap-y-3">
          <Link href="/#asboblar">Asboblar</Link>
          <Link href="/#qanday">Qanday ishlaydi</Link>
          <Link href="/elon-berish">Eʼlon berish</Link>
          <Link href="/kirish">Kirish</Link>
          <Link href="/royxatdan-otish">Roʻyxatdan oʻtish</Link>
        </nav>
        <p className="max-w-md text-paper/80 md:text-right">
          Sinov loyihasi: haqiqiy ijara, toʻlov yoki xabar yuborish amalga oshirilmaydi.
        </p>
      </div>
    </footer>
  );
}
