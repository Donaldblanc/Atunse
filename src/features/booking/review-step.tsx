"use client";

import Link from "next/link";
import { ArrowRight, ImagePlus, Info, Mail, MapPin, Package, Phone, Truck, TriangleAlert, User, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { formatDate, type PickupSelection } from "./pickup-date-picker";
import type { ContactInfo, PairDetails, PickupAddress, ScheduleMethod, Step } from "./booking-types";
import { BookingSubmitError } from "./submit-booking";
import { catalogService } from "@/features/orders/service-catalog";

export function ReviewStep({
  isBundle,
  name,
  price,
  priceNote,
  Icon,
  pairs,
  scheduleMethod,
  pickupAddress,
  pickupSelection,
  mailInDate,
  contact,
  onEdit,
  onEditPair,
  onConfirm,
}: {
  isBundle: boolean;
  name: string;
  price: string;
  priceNote: string | undefined;
  Icon: LucideIcon;
  /** One pair, or a Bundle's three, in the order they were entered. */
  pairs: PairDetails[];
  scheduleMethod: ScheduleMethod;
  pickupAddress: PickupAddress;
  pickupSelection: PickupSelection | null;
  mailInDate: PickupSelection | null;
  contact: ContactInfo;
  onEdit: (step: Step) => void;
  /** Opens the Details step on pair `index`. */
  onEditPair: (index: number) => void;
  onConfirm: (policyAccepted: boolean) => Promise<void>;
}) {
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showPolicyWarning = attempted && !policyAccepted;

  async function confirm() {
    if (submitting) return;
    if (!policyAccepted) {
      setAttempted(true);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(policyAccepted);
    } catch (err) {
      setError(err instanceof BookingSubmitError ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const scheduleText =
    scheduleMethod === "pickup"
      ? pickupSelection
        ? `${formatDate(pickupSelection.date)} · ${pickupSelection.time}`
        : "Not scheduled yet"
      : mailInDate
        ? formatDate(mailInDate.date)
        : "No preferred date selected";

  return (
    <>
      <div className="booking-page-section-head">
        <p className="booking-page-step-eyebrow">STEP 5 OF 5</p>
        <h2>Review &amp; confirm.</h2>
        <p>Here&rsquo;s a summary of your order. You can go back to make changes.</p>
      </div>

      <div className="booking-page-review-card">
        <div className="booking-page-review-head">
          <span>{isBundle ? "BUNDLE SUMMARY" : "ORDER SUMMARY"}</span>
          <button type="button" className="booking-page-edit-link" onClick={() => onEdit("service")}>
            Edit
          </button>
        </div>
        <div className="booking-page-review-line">
          <span className="booking-page-review-thumb" aria-hidden="true">
            <Icon size={20} />
          </span>
          <span className="booking-page-review-line-body">
            <strong>{name}</strong>
            {priceNote && <span>{priceNote}</span>}
          </span>
          <span className="booking-page-review-line-price">{price}</span>
        </div>
        {isBundle && (
          <div className="booking-page-details-row">
            <Info size={16} aria-hidden="true" />
            <span>Every pair gets Premium Clean. We&rsquo;ll decide which pairs get the Bundle&rsquo;s other extras once we&rsquo;ve inspected them.</span>
          </div>
        )}
      </div>

      {pairs.map((pair, i) => (
        <div className="booking-page-review-card" key={i}>
          <div className="booking-page-review-head">
            <span>{pairs.length === 1 ? "YOUR PAIR" : `PAIR ${i + 1}`}</span>
            <button type="button" className="booking-page-edit-link" onClick={() => onEditPair(i)}>
              Edit
            </button>
          </div>
          <PairSummary pair={pair} />
        </div>
      ))}

      <div className="booking-page-review-card">
        <div className="booking-page-review-head">
          <span>SCHEDULE</span>
          <button type="button" className="booking-page-edit-link" onClick={() => onEdit("schedule")}>
            Edit
          </button>
        </div>
        <div className="booking-page-details-row">
          {scheduleMethod === "pickup" ? <Truck size={16} aria-hidden="true" /> : <Package size={16} aria-hidden="true" />}
          <span>
            <strong>{scheduleMethod === "pickup" ? "Pickup" : "Mail in"}</strong>, {scheduleText}
          </span>
        </div>
        <div className="booking-page-details-row">
          <MapPin size={16} aria-hidden="true" />
          <span>
            {pickupAddress.address || "No address entered yet"}
            {pickupAddress.apt && `, ${pickupAddress.apt}`}
            <br />
            {[pickupAddress.city, [pickupAddress.state, pickupAddress.zip].filter(Boolean).join(" ")]
              .filter(Boolean)
              .join(", ")}
          </span>
        </div>
      </div>

      <div className="booking-page-review-card">
        <div className="booking-page-review-head">
          <span>CONTACT</span>
          <button type="button" className="booking-page-edit-link" onClick={() => onEdit("contact")}>
            Edit
          </button>
        </div>
        <div className="booking-page-details-row">
          <User size={16} aria-hidden="true" />
          <span>{contact.name || "—"}</span>
        </div>
        <div className="booking-page-details-row">
          <Mail size={16} aria-hidden="true" />
          <span>{contact.email || "—"}</span>
        </div>
        <div className="booking-page-details-row">
          <Phone size={16} aria-hidden="true" />
          <span>{contact.phone || "—"}</span>
        </div>
      </div>

      <label className="booking-page-policy">
        <input
          type="checkbox"
          checked={policyAccepted}
          onChange={(e) => setPolicyAccepted(e.target.checked)}
          aria-describedby={showPolicyWarning ? "review-step-policy-warning" : undefined}
        />
        <span>
          I agree to the <Link href="/coming-soon">Terms of Service</Link>, Refund Policy, Restoration Disclaimer, and
          Payment Policy.
        </span>
      </label>

      <button
        type="button"
        className="landing-btn-primary booking-page-continue-btn"
        onClick={confirm}
        disabled={submitting}
        aria-busy={submitting}
      >
        {submitting ? "Submitting…" : "Confirm Booking"}
        {!submitting && <ArrowRight size={14} aria-hidden="true" />}
      </button>
      <p className="booking-page-form-warning" id="review-step-policy-warning" role="status" aria-live="polite">
        {showPolicyWarning && (
          <>
            <TriangleAlert size={14} aria-hidden="true" />
            Please accept the policies to confirm your booking.
          </>
        )}
      </p>
      {error && (
        <p className="booking-page-form-error" role="alert">
          <TriangleAlert size={14} aria-hidden="true" />
          {error}
        </p>
      )}
      <p className="booking-page-terms">
        See our <Link href="/coming-soon">Privacy Policy</Link> for how we handle your details.
      </p>
    </>
  );
}

function PairSummary({ pair }: { pair: PairDetails }) {
  return (
    <>
      <div className="booking-page-details-row">
        <User size={16} aria-hidden="true" />
        <span>
          Brand / Model: <strong>{pair.brand || "—"}</strong>
        </span>
      </div>
      <div className="booking-page-details-row">
        <span>
          Material: <strong>{pair.material || "—"}</strong>
        </span>
      </div>
      <div className="booking-page-details-row">
        <ImagePlus size={16} aria-hidden="true" />
        <span>
          Photos:{" "}
          <strong>
            {pair.photos.length > 0 ? `${pair.photos.length} photo${pair.photos.length === 1 ? "" : "s"}` : "No photos"}
          </strong>
        </span>
      </div>
      <div className="booking-page-details-row">
        <span>
          Notes: <strong>{pair.notes || "No notes"}</strong>
        </span>
      </div>
      <div className="booking-page-details-row">
        <span>
          Add-ons: <strong>{pair.addOnIds.map((id) => catalogService(id).name).join(", ") || "None"}</strong>
        </span>
      </div>
    </>
  );
}
