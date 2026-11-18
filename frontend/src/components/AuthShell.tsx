import type { ReactNode } from "react";

/** Auth forms sit on one filled card, on the page's surface tone. */
export function AuthShell({ title, children }: { eyebrow?: string; title: string; children: ReactNode }) {
  return (
    <div className="px-[var(--margin)] pb-24 pt-6">
      <div className="hang-in mx-auto max-w-md rounded-[4px] bg-wall px-6 py-10 sm:px-10">
        <h1 className="font-display text-head">{title}</h1>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
