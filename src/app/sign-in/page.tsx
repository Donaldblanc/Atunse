"use client";

// Sign-in page, styled with the shared admin design system
// (src/styles/admin-theme.css) so admin auth and the admin dashboard read
// as one product. This is a UI shell only: no auth provider is wired yet
// (ADR-0005 — managed auth provider is still TBD), so submitting shows an
// explanatory message instead of silently pretending to sign the user in.

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SquaresFourIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const [submitted, setSubmitted] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

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

        {submitted && (
          <div className="auth-error" role="alert" tabIndex={-1} ref={errorRef}>
            <WarningCircleIcon size={18} weight="fill" aria-hidden="true" />
            <span>
              Sign-in isn&apos;t wired up yet — the auth provider is still being chosen (ADR-0005).
              This screen is a preview of the admin design system.
            </span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
            requestAnimationFrame(() => errorRef.current?.focus());
          }}
        >
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

          <button type="submit" className="admin-btn auth-submit" data-variant="primary">
            Sign in
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
