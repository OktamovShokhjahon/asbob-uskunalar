"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { AuthShell } from "@/components/AuthShell";
import { useAuth } from "@/components/AuthProvider";
import { Button, Field, FormError, describedBy, inputClass } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { hasErrors, validateRegister, type FieldErrors } from "@/lib/validation";

type Key = "fullName" | "username" | "password" | "password2";

function RegisterForm() {
  const { user, ready, register } = useAuth();
  const router = useRouter();
  const raw = useSearchParams().get("keyin");
  const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/kabinet";

  const [form, setForm] = useState<Record<Key, string>>({ fullName: "", username: "", password: "", password2: "" });
  const [errors, setErrors] = useState<FieldErrors<Key>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace(next);
  }, [ready, user, next, router]);

  const set = (k: Key) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const v = validateRegister(form);
    setErrors(v);
    if (hasErrors(v)) return;

    setBusy(true);
    try {
      await register(form);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) setErrors(err.fields);
        else setFormError(err.message);
      } else setFormError("Kutilmagan xatolik. Qayta urinib koʻring.");
      setBusy(false);
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5">
      <FormError message={formError} />
      <Field id="fullName" label="Ismingiz" required error={errors.fullName}>
        <input
          id="fullName"
          autoComplete="name"
          placeholder="Masalan, Dilnoza Karimova"
          value={form.fullName}
          onChange={set("fullName")}
          className={inputClass(errors.fullName)}
          {...describedBy("fullName", errors.fullName)}
        />
      </Field>
      <Field
        id="username"
        label="Foydalanuvchi nomi"
        hint="Lotin harflari, raqam va _ · 3–20 belgi"
        required
        error={errors.username}
      >
        <input
          id="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="dilnoza_k"
          value={form.username}
          onChange={set("username")}
          className={`${inputClass(errors.username)} font-mono`}
          {...describedBy("username", errors.username, true)}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="password" label="Parol" hint="Kamida 6 belgi" required error={errors.password}>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            className={inputClass(errors.password)}
            {...describedBy("password", errors.password, true)}
          />
        </Field>
        <Field id="password2" label="Parolni takrorlang" hint="Xuddi shu parol" required error={errors.password2}>
          <input
            id="password2"
            type="password"
            autoComplete="new-password"
            value={form.password2}
            onChange={set("password2")}
            className={inputClass(errors.password2)}
            {...describedBy("password2", errors.password2, true)}
          />
        </Field>
      </div>
      <Button type="submit" variant="stamp" busy={busy} className="w-full py-3.5 text-lg">
        Roʻyxatdan oʻtish
      </Button>
      <p className="text-center text-sm text-ink/75">
        Hisobingiz bormi?{" "}
        <Link
          href="/kirish"
          className="font-semibold text-ink underline decoration-ink decoration-2 underline-offset-4"
        >
          Kirish
        </Link>
      </p>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <AuthShell eyebrow="Yangi hisob · eʼlon berish uchun" title="Roʻyxatdan oʻtish">
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
