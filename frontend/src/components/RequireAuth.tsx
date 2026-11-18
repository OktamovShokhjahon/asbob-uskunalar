"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { Role, User } from "@/lib/types";
import { useAuth } from "./AuthProvider";
import { Spinner } from "./ui";

/** Renders children only for a signed-in user (optionally with a given role). */
export function RequireAuth({ role, children }: { role?: Role; children: (user: User) => ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !user) router.replace(`/kirish?keyin=${encodeURIComponent(pathname)}`);
  }, [ready, user, router, pathname]);

  if (!ready || !user) return <Spinner />;

  if (role && user.role !== role) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-sm font-semibold text-stamp">Ruxsat yoʻq</p>
        <h1 className="mt-3 font-display text-4xl font-extrabold uppercase">Bu sahifa superadmin uchun</h1>
        <p className="mt-3 text-muted">Siz oddiy foydalanuvchi sifatida kirgansiz.</p>
        <Link href="/" className="mt-6 inline-flex btn btn-ink">
          Bosh sahifaga
        </Link>
      </div>
    );
  }

  return <>{children(user)}</>;
}
