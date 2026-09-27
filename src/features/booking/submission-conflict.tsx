"use client";

import { useState } from "react";
import { ArrowRight, Info, TriangleAlert } from "lucide-react";
import type { SubmitOrderResponse } from "./submit-booking";

// Shown when this booking's first Confirm already went through (its
// response was lost), and the customer changed details before retrying
// (#76). The server won't silently swap in the edits, so the customer
// chooses: keep the booking that was received, or book the changes as a
// separate, new booking.
export function SubmissionConflict({
  message,
  existing,
  onViewExisting,
  onBookAsNew,
}: {
  message: string;
  existing: SubmitOrderResponse;
  onViewExisting: () => void;
  /** Resubmits under a new submission key; rejects with a displayable error. */
  onBookAsNew: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function bookAsNew() {
    setBusy(true);
    setError(null);
    try {
      await onBookAsNew();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="booking-page-section-head">
        <p className="booking-page-step-eyebrow">ALREADY RECEIVED</p>
        <h2>We already have this booking.</h2>
        <p>{message}</p>
      </div>

      <div className="booking-page-info-box">
        <Info size={16} aria-hidden="true" />
        <span>
          Booking <strong>{existing.order.reference}</strong> went through before your changes. Keep it, or book your
          changes as a separate booking (you&rsquo;d then have two).
        </span>
      </div>

      <button type="button" className="landing-btn-primary booking-page-continue-btn" onClick={onViewExisting} disabled={busy}>
        See booking {existing.order.reference}
        <ArrowRight size={14} aria-hidden="true" />
      </button>
      <p className="booking-page-terms">
        <button type="button" className="booking-page-edit-link" onClick={bookAsNew} disabled={busy} aria-busy={busy}>
          {busy ? "Booking…" : "Book my changes as a new booking"}
        </button>
      </p>
      {error && (
        <p className="booking-page-form-error" role="alert">
          <TriangleAlert size={14} aria-hidden="true" />
          {error}
        </p>
      )}
    </>
  );
}
