"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { AuthShell } from "@/components/AuthShell";
import { useAuth } from "@/components/AuthProvider";
import { Button, Field, FormError, describedBy, inputClass } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { hasErrors, validateLogin, type FieldErrors } from "@/lib/validation";

function safeNext(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
}

function LoginForm() {
  const { user, ready, login } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("keyin"));

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors<"username" | "password">>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Already signed in: go where they were heading.
  useEffect(() => {
    if (ready && user) router.replace(next ?? (user.role === "superadmin" ? "/admin" : "/kabinet"));
  }, [ready, user, next, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(undefined);
    const v = validateLogin({ username, password });
    setErrors(v);
    if (hasErrors(v)) return;

    setBusy(true);
    try {
      await login(username, password);
      // redirect handled by the effect above
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Kutilmagan xatolik. Qayta urinib koʻring.");
      setBusy(false);
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5">
      <FormError message={formError} />
      <Field id="username" label="Foydalanuvchi nomi" error={errors.username}>
        <input
          id="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={inputClass(errors.username)}
          {...describedBy("username", errors.username)}
        />
      </Field>
      <Field id="password" label="Parol" error={errors.password}>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass(errors.password)}
          {...describedBy("password", errors.password)}
        />
      </Field>
      <Button type="submit" variant="ink" busy={busy} className="w-full py-3.5 text-lg">
        Kirish
      </Button>
      <p className="text-center text-sm text-ink/75">
        Hisobingiz yoʻqmi?{" "}
        <Link
          href={next ? `/royxatdan-otish?keyin=${encodeURIComponent(next)}` : "/royxatdan-otish"}
          className="font-semibold text-ink underline decoration-ink decoration-2 underline-offset-4"
        >
          Roʻyxatdan oʻting
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell eyebrow="Hisobga kirish" title="Kirish">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
