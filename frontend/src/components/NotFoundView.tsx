import Link from "next/link";

export function NotFoundView() {
  return (
    <div className="pegboard px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-md text-center">
        
        <div className="mx-auto h-16 w-0.5 bg-[#6f5a2c]/40" aria-hidden />
        <p className="text-sm font-semibold text-muted">404 · Boʻsh ilgak</p>
        <h1 className="mt-3 font-display text-5xl font-extrabold uppercase leading-none">Bunday asbob yoʻq</h1>
        <p className="mt-4 text-muted">
          Bu ilgakda hech narsa osilmagan: eʼlon yoʻq yoki hali tasdiqlanmagan. Javondagi asboblardan birini tanlang.
        </p>
        <Link
          href="/#asboblar"
          className="mt-8 inline-flex btn btn-ink"
        >
          Katalogga qaytish
        </Link>
      </div>
    </div>
  );
}
