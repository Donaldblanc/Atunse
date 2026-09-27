"use client";

import { useState } from "react";
import { ArrowRight, Mail, TriangleAlert } from "lucide-react";

// The customer's login screen (ADR-0014), separate from the admin /sign-in
// page. Shown by the booking flow only when the booking's email already
// has an Account (the server answered SIGN_IN_REQUIRED): the customer
// proves the email with a one-time code, and the flow then finishes the
// booking under their Account.
export function CustomerSignIn({
  email,
  onSignedIn,
  onUseDifferentEmail,
}: {
  email: string;
  /** Called once the session cookie is set; resubmits the booking. */
  onSignedIn: () => Promise<void>;
  onUseDifferentEmail: () => void;
}) {
  const [codeSent, setCodeSent] = useState(false);
  // Once the code is accepted the session exists and the code is used up:
  // a retry must only resubmit the booking, never re-verify the code.
  const [signedIn, setSignedIn] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function post(url: string, body: object): Promise<string | null> {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return null;
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return data.error ?? "Something went wrong. Please try again.";
    } catch {
      return "Couldn't reach the server. Check your connection and try again.";
    }
  }

  async function sendCode() {
    setBusy(true);
    setError(null);
    const failure = await post("/api/v1/auth/code/request", { email });
    setBusy(false);
    if (failure) return setError(failure);
    setCodeSent(true);
    // Worded conditionally: the server answers the same way when it sends
    // nothing (e.g. too many recent codes), so it can't be used to probe.
    setNotice(`If ${email} has an account, a 6-digit code is on its way. It expires in 10 minutes.`);
  }

  async function finishBooking() {
    setBusy(true);
    setError(null);
    setNotice("Signed in. Finishing your booking…");
    try {
      await onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  async function verify() {
    if (!/^\d{6}$/.test(code.trim())) return setError("Enter the 6-digit code from the email.");
    setBusy(true);
    setError(null);
    const failure = await post("/api/v1/auth/code/verify", { email, code: code.trim() });
    if (failure) {
      setBusy(false);
      return setError(failure);
    }
    setSignedIn(true);
    await finishBooking();
  }

  return (
    <>
      <div className="booking-page-section-head">
        <p className="booking-page-step-eyebrow">WELCOME BACK</p>
        <h2>Sign in to finish booking.</h2>
        <p>
          You already have an account with <strong>{email}</strong>. We&rsquo;ll email you a one-time code; your
          booking details are kept.
        </p>
      </div>

      {signedIn ? (
        <button
          type="button"
          className="landing-btn-primary booking-page-continue-btn"
          onClick={finishBooking}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? "Finishing…" : "Try confirming again"}
          {!busy && <ArrowRight size={14} aria-hidden="true" />}
        </button>
      ) : codeSent ? (
        <>
          <div className="booking-page-form-grid">
            <label className="booking-page-field">
              <span>6-digit code</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && !busy && verify()}
              />
            </label>
          </div>
          <button
            type="button"
            className="landing-btn-primary booking-page-continue-btn"
            onClick={verify}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? "Checking…" : "Sign in and confirm booking"}
            {!busy && <ArrowRight size={14} aria-hidden="true" />}
          </button>
          <p className="booking-page-terms">
            Didn&rsquo;t get it? Check spam, or{" "}
            <button type="button" className="booking-page-edit-link" onClick={sendCode} disabled={busy}>
              send a new code
            </button>
            . You can request up to 5 codes every 15 minutes.
          </p>
        </>
      ) : (
        <button
          type="button"
          className="landing-btn-primary booking-page-continue-btn"
          onClick={sendCode}
          disabled={busy}
          aria-busy={busy}
        >
          <Mail size={14} aria-hidden="true" />
          {busy ? "Sending…" : `Email me a code`}
        </button>
      )}

      <p className="booking-page-form-notice" role="status" aria-live="polite">
        {notice}
      </p>
      {error && (
        <p className="booking-page-form-error" role="alert">
          <TriangleAlert size={14} aria-hidden="true" />
          {error}
        </p>
      )}
      {!signedIn && (
        <p className="booking-page-terms">
          Not you?{" "}
          <button type="button" className="booking-page-edit-link" onClick={onUseDifferentEmail} disabled={busy}>
            Use a different email
          </button>
        </p>
      )}
    </>
  );
}
