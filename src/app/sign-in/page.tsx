"use client";

// Sign-in page, styled with the shared admin design system
// (src/styles/admin-theme.css) so admin auth and the admin dashboard read
// as one product. Posts to /api/v1/auth/sign-in, the interim credential
// login (ADR-0005 addendum) — a bootstrap admin account is created via
// `npm run prisma:seed`. Swap this POST target for a managed provider's
// flow later without touching the visual shell.

import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SquaresFourIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    try {
      const res = await fetch("/api/v1/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Sign-in failed" }));
        setError(body.error ?? "Sign-in failed");
        requestAnimationFrame(() => errorRef.current?.focus());
        return;
      }

      router.push(from && from.startsWith("/admin") ? from : "/admin");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="admin-brand-mark" aria-hidden="true">
            <SquaresFourIcon size={18} weight="bold" />
          </span>
          <span className="auth-title">Atunṣe Admin</span>
        </div>

        <p className="auth-subtitle">
          Sign in to manage RestoredByDJ orders, quotes, and payments.
          {from && from !== "/admin" ? ` You'll be returned to ${from} after signing in.` : null}
        </p>

        {error && (
          <div className="auth-error" role="alert" tabIndex={-1} ref={errorRef}>
            <WarningCircleIcon size={18} weight="fill" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className="auth-input"
              placeholder="you@restoredbydj.com"
              required
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="auth-input"
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="admin-btn auth-submit" data-variant="primary" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="auth-note">
          Admin access only. Customer accounts will get their own sign-in flow
          once account linking ships.
        </p>
      </div>
    </div>
  );
}
