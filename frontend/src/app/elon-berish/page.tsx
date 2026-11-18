"use client";

import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
import { PhotoUploader } from "@/components/PhotoUploader";
import { RequireAuth } from "@/components/RequireAuth";
import { ToolIcon } from "@/components/ToolIcon";
import { ToolTag } from "@/components/ToolTag";
import { Button, Field, FormError, describedBy, inputClass } from "@/components/ui";
import { ApiError, createListing } from "@/lib/api";
import { ICON_OPTIONS, type IconKind, type Listing, type User } from "@/lib/types";
import { hasErrors, parsePrice, validateListing, type FieldErrors } from "@/lib/validation";

type Key = "title" | "description" | "price" | "photos";

type Photos = { ids: string[]; previews: string[]; uploading: boolean };
const NO_PHOTOS: Photos = { ids: [], previews: [], uploading: false };

function NewListingForm({ user }: { user: User }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [icon, setIcon] = useState<IconKind>("drill");
  const [photos, setPhotos] = useState<Photos>(NO_PHOTOS);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [errors, setErrors] = useState<FieldErrors<Key>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Listing | null>(null);

  // Stable: PhotoUploader reports through an effect.
  const onPhotos = useCallback((p: Photos) => {
    setPhotos(p);
    if (p.ids.length > 0) setErrors((e) => ({ ...e, photos: undefined }));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const v: FieldErrors<Key> = {
      ...validateListing({ title, description, price }),
      ...(photos.uploading
        ? { photos: "Rasmlar hali yuklanmoqda, biroz kuting" }
        : photos.ids.length === 0
          ? { photos: "Kamida bitta rasm qoʻshing" }
          : {}),
    };
    setErrors(v);
    if (hasErrors(v)) return;

    setBusy(true);
    try {
      const l = await createListing({ title, description, pricePerDay: parsePrice(price)!, icon, photos: photos.ids });
      setCreated(l);
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        const f = err.fields;
        setErrors({ title: f.title, description: f.description, price: f.pricePerDay, photos: f.photos });
        if (f.icon) setFormError(f.icon);
      } else setFormError(err instanceof Error ? err.message : "Kutilmagan xatolik");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setTitle("");
    setDescription("");
    setPrice("");
    setIcon("drill");
    setPhotos(NO_PHOTOS);
    setUploaderKey((k) => k + 1); // fresh, empty uploader
    setErrors({});
    setCreated(null);
  }

  if (created) {
    const live = created.status === "approved";
    return (
      <div className="pegboard min-h-[calc(100dvh-140px)] px-4 py-14 sm:px-6">
        <div className="hang-in mx-auto grid max-w-4xl items-start gap-10 md:grid-cols-2">
          <ToolTag tool={created} tilt={-1.5} large tone="ink" />
          <div className="rounded-xl bg-paper p-7">
            <p className={`text-sm font-semibold ${live ? "text-ok" : "text-muted"}`}>
              Eʼlon {created.id}
            </p>
            <h1 className="mt-2 font-display text-4xl font-extrabold uppercase leading-[0.95]">
              {live ? "Eʼlon joylandi" : "Eʼlon tekshiruvga yuborildi"}
            </h1>
            <p className="mt-3 text-muted">
              {live
                ? "Superadmin eʼlonlari tekshiruvsiz katalogda koʻrinadi."
                : "Superadmin tasdiqlagach, eʼlon katalogda paydo boʻladi. Holatini kabinetingizda kuzatib boring."}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href={live ? `/ijara/${created.id}` : "/kabinet"}
                className="flex-1 btn btn-ink"
              >
                {live ? "Katalogda koʻrish" : "Kabinetga oʻtish"}
              </Link>
              <button
                type="button"
                onClick={reset}
                className="flex-1 rounded-full border-2 border-ink px-5 py-3 font-semibold hover:bg-white"
              >
                Yana eʼlon berish
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const preview = {
    id: "E···",
    title: title.trim(),
    description: description.trim(),
    pricePerDay: parsePrice(price) ?? 0,
    icon,
    ownerUsername: user.username,
    photos: photos.previews,
  };

  return (
    <div className="grid md:grid-cols-[1.1fr_1fr]">
      {/* Form */}
      <section className="bg-paper px-4 py-10 sm:px-6 md:py-14">
        <div className="mx-auto max-w-lg md:ml-auto md:mr-10">
          <p className="text-sm font-semibold text-muted">Yangi eʼlon</p>
          <h1 className="mt-3 font-display text-5xl font-extrabold uppercase leading-[0.9]">Asbobingizni ijaraga bering</h1>
          <p className="mt-3 text-muted">
            {user.role === "superadmin"
              ? "Siz superadminsiz: eʼloningiz darhol katalogga chiqadi."
              : "Eʼlon superadmin tasdiqlagandan keyin katalogda koʻrinadi."}
          </p>

          <form noValidate onSubmit={onSubmit} className="mt-8 space-y-6">
            <FormError message={formError} />

            <PhotoUploader key={uploaderKey} onChange={onPhotos} error={errors.photos} />

            <Field id="title" label="Asbob nomi" hint="Masalan: Perforator, Payvandlash apparati" required error={errors.title}>
              <input
                id="title"
                value={title}
                maxLength={60}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass(errors.title)}
                {...describedBy("title", errors.title, true)}
              />
            </Field>

            <Field id="description" label="Qisqa tavsif" hint="Nima uchun kerak boʻladi · 5–80 belgi" required error={errors.description}>
              <input
                id="description"
                value={description}
                maxLength={100}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass(errors.description)}
                {...describedBy("description", errors.description, true)}
              />
            </Field>

            <Field id="price" label="Kunlik narx, soʻm" hint="1 000 – 10 000 000 soʻm" required error={errors.price}>
              <input
                id="price"
                inputMode="numeric"
                placeholder="50 000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={`${inputClass(errors.price)} font-mono`}
                {...describedBy("price", errors.price, true)}
              />
            </Field>

            <fieldset>
              <legend className="font-semibold">Turi</legend>
              <p className="mt-0.5 text-sm text-muted">Yorliqdagi belgi shunga qarab tanlanadi</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ICON_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-3 text-center text-xs font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-stamp ${
                      icon === o.value ? "border-ink bg-tag/50" : "border-line bg-white hover:border-ink/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="icon"
                      value={o.value}
                      checked={icon === o.value}
                      onChange={() => setIcon(o.value)}
                      className="sr-only"
                    />
                    <ToolIcon kind={o.value} className="h-8 w-8" />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <Button type="submit" busy={busy || photos.uploading} className="w-full py-4 text-lg">
              {user.role === "superadmin" ? "Eʼlonni joylash" : "Tekshiruvga yuborish"}
            </Button>
          </form>
        </div>
      </section>

      {/* Live preview */}
      <section className="pegboard px-4 pb-14 pt-10 sm:px-6 md:pt-14">
        <div className="mx-auto max-w-md md:sticky md:top-24 md:ml-10 md:mr-auto">
          <p className="text-sm font-semibold text-muted">Katalogda shunday koʻrinadi</p>
          <div className="mt-6">
            <ToolTag tool={preview} tilt={1.2} large tone="ink" />
          </div>
        </div>
      </section>
    </div>
  );
}

export default function NewListingPage() {
  return <RequireAuth>{(user) => <NewListingForm user={user} />}</RequireAuth>;
}
