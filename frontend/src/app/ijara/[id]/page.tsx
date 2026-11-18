"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/components/AuthProvider";
import { NotFoundView } from "@/components/NotFoundView";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { RentalForm } from "@/components/RentalForm";
import { ToolTag } from "@/components/ToolTag";
import { LoadError, Spinner } from "@/components/ui";
import { useRouteListing } from "@/components/useListing";

function RentView() {
  const { listing: tool, error, retry } = useRouteListing();
  const kun = useSearchParams().get("kun");
  const { user, ready } = useAuth();

  if (error) return <div className="px-4 py-16"><LoadError message={error} onRetry={retry} /></div>;
  if (tool === undefined || !ready) return <Spinner />;
  if (tool === null) return <NotFoundView />;

  return (
    <div className="grid md:min-h-[calc(100dvh-140px)] md:grid-cols-[1fr_1.1fr]">
      {/* The chosen tag, still on the pegboard */}
      <section className="pegboard px-4 pb-12 pt-8 sm:px-6">
        <div className="mx-auto max-w-md md:ml-auto md:mr-10">
          <Link href="/#asboblar" className="btn btn-sm btn-on-ink">
            <span aria-hidden>←</span> Orqaga
          </Link>
          <div className="mt-8">
            <PhotoCarousel photos={tool.photos ?? []} alt={tool.title} icon={tool.icon} size="large" />
          </div>
          {/* ink card: a grey card would vanish on the grey column */}
          <div className="mt-8">
            <ToolTag tool={tool} tilt={-1.5} large tone="ink" media={false} />
          </div>
        </div>
      </section>

      {/* The form */}
      <section className="bg-paper px-4 py-10 sm:px-6 md:py-14">
        <div className="mx-auto max-w-lg md:ml-10 md:mr-auto">
          <p className="text-sm font-semibold text-muted">Ijara shakli · {tool.id}</p>
          <h1 className="mt-3 break-words font-display text-5xl font-extrabold uppercase leading-[0.9]">{tool.title}</h1>
          <p className="mt-2 text-muted">{tool.description}</p>
          <div className="mt-8">
            <RentalForm tool={tool} initialDays={kun ?? "1"} initialName={user?.fullName ?? ""} />
          </div>
        </div>
      </section>
    </div>
  );
}

export default function RentPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <RentView />
    </Suspense>
  );
}
