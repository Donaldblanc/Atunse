"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail, TriangleAlert } from "lucide-react";

// Signed-out state of "My bookings": the same email-code sign-in the
// booking flow uses (ADR-0014; /sign-in is the admin password page). Once
// the code is accepted the customer session cookie is set and the page
// re-renders with their bookings.
export function AccountSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(url: string, body: object): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) return true;
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    }
    setBusy(false);
    return false;
  }

  async function sendCode() {
    if (!email.trim()) return setError("Enter the email you booked with.");
    if (await post("/api/v1/auth/code/request", { email: email.trim() })) {
      setCodeSent(true);
      setBusy(false);
    }
  }

  async function verify() {
    if (!/^\d{6}$/.test(code.trim())) return setError("Enter the 6-digit code from the email.");
    if (await post("/api/v1/auth/code/verify", { email: email.trim(), code: code.trim() })) router.refresh();
  }

  return (
    <div className="acct-signin">
      <p>Enter the email you booked with and we&rsquo;ll send you a one-time code.</p>
      <label className="acct-field">
        <span>Email</span>
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={codeSent} />
      </label>
      {codeSent ? (
        <>
          <p role="status">If {email.trim()} has an account, a 6-digit code is on its way. It expires in 10 minutes.</p>
          <label className="acct-field">
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
          <button type="button" className="landing-btn-primary" onClick={verify} disabled={busy} aria-busy={busy}>
            {busy ? "Checking…" : "Sign in"}
            {!busy && <ArrowRight size={14} aria-hidden="true" />}
          </button>
        </>
      ) : (
        <button type="button" className="landing-btn-primary" onClick={sendCode} disabled={busy} aria-busy={busy}>
          <Mail size={14} aria-hidden="true" />
          {busy ? "Sending…" : "Email me a code"}
        </button>
      )}
      {error && (
        <p className="acct-error" role="alert">
          <TriangleAlert size={14} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
