"use client";

import { useState } from "react";
import { ArrowRight, Info, Package, Truck, TriangleAlert } from "lucide-react";
import { PickupDatePicker, type PickupSelection } from "./pickup-date-picker";
import type { PickupAddress, ScheduleMethod } from "./booking-types";
import { FULFILLMENT_LABELS } from "@/features/orders/domain";
import { isValidZip } from "@/features/orders/contact-rules";
import { calendarDateInLocalTime } from "@/features/orders/calendar-date";
import { availablePickupSlots, PICKUP_LEAD_MINUTES, PICKUP_STATES, US_STATES } from "@/features/orders/pickup-window";

export function ScheduleStep({
  method,
  onSelectMethod,
  pickupAddress,
  onChangePickupAddress,
  pickupSelection,
  onConfirmPickup,
  mailInDate,
  onChangeMailInDate,
  onContinue,
}: {
  method: ScheduleMethod;
  onSelectMethod: (method: ScheduleMethod) => void;
  pickupAddress: PickupAddress;
  onChangePickupAddress: (address: PickupAddress) => void;
  pickupSelection: PickupSelection | null;
  onConfirmPickup: (selection: PickupSelection) => void;
  mailInDate: PickupSelection | null;
  onChangeMailInDate: (selection: PickupSelection) => void;
  onContinue: () => void;
}) {
  const [attempted, setAttempted] = useState(false);
  const problem = scheduleProblem(method, pickupAddress, pickupSelection);
  const showWarning = attempted && problem !== null;

  return (
    <>
      <div className="booking-page-section-head">
        <p className="booking-page-step-eyebrow">STEP 3 OF 5</p>
        <h2>Local Drop-Off or mail in?</h2>
        <p>Choose how you&rsquo;d like to get your sneakers to us, and back.</p>
      </div>

      <div className="booking-page-shipping-grid">
        <button type="button" className="booking-page-shipping-card" data-active={method === "pickup"} onClick={() => onSelectMethod("pickup")}>
          <Truck size={20} aria-hidden="true" />
          <span>
            <strong>{FULFILLMENT_LABELS.PICKUP}</strong>
            <span>DJ collects your sneakers from your address (NY / NJ / CT) and drops them back off when they&rsquo;re done.</span>
          </span>
        </button>
        <button type="button" className="booking-page-shipping-card" data-active={method === "mail-in"} onClick={() => onSelectMethod("mail-in")}>
          <Package size={20} aria-hidden="true" />
          <span>
            <strong>{FULFILLMENT_LABELS.MAIL_IN}</strong>
            <span>We&rsquo;ll email you where to ship after checkout, and ship them back when they&rsquo;re done.</span>
          </span>
        </button>
      </div>

      <div className="booking-page-section-head booking-page-section-head-tight">
        <p className="booking-page-step-eyebrow" style={{ margin: 0 }}>
          {method === "pickup" ? "COLLECTION ADDRESS" : "SHIPPING ADDRESS"}
        </p>
      </div>
      <div className="booking-page-form-grid">
        <label className="booking-page-field">
          <span>Address</span>
          <input
            type="text"
            placeholder="e.g. 123 Main St"
            value={pickupAddress.address}
            onChange={(e) => onChangePickupAddress({ ...pickupAddress, address: e.target.value })}
          />
        </label>
        <label className="booking-page-field">
          <span>Apt, suite, etc. (optional)</span>
          <input
            type="text"
            placeholder="e.g. Apt 4B"
            value={pickupAddress.apt}
            onChange={(e) => onChangePickupAddress({ ...pickupAddress, apt: e.target.value })}
          />
        </label>
      </div>
      <div className="booking-page-form-grid booking-page-form-grid-thirds">
        <label className="booking-page-field">
          <span>City</span>
          <input
            type="text"
            placeholder="e.g. New York"
            value={pickupAddress.city}
            onChange={(e) => onChangePickupAddress({ ...pickupAddress, city: e.target.value })}
          />
        </label>
        <label className="booking-page-field">
          <span>State / Province</span>
          <select
            value={pickupAddress.state}
            onChange={(e) => onChangePickupAddress({ ...pickupAddress, state: e.target.value })}
          >
            <option value="" disabled>
              Select
            </option>
            {(method === "pickup" ? PICKUP_STATES : US_STATES).map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>
        </label>
        <label className="booking-page-field">
          <span>Zip / Postal code</span>
          <input
            type="text"
            placeholder="e.g. 10001"
            value={pickupAddress.zip}
            onChange={(e) => onChangePickupAddress({ ...pickupAddress, zip: e.target.value })}
          />
        </label>
      </div>

      {method === "pickup" ? (
        <>
          <div className="booking-page-section-head booking-page-section-head-tight">
            <p className="booking-page-step-eyebrow" style={{ margin: 0 }}>
              COLLECTION DATE &amp; TIME
            </p>
          </div>
          <PickupDatePicker selection={pickupSelection} onConfirm={onConfirmPickup} />

          <div className="booking-page-info-box">
            <Info size={16} aria-hidden="true" />
            <span>
              DJ collects between
              <br />
              <strong>4:30 PM &ndash; 10:00 PM.</strong>
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="booking-page-section-head booking-page-section-head-tight">
            <p className="booking-page-step-eyebrow" style={{ margin: 0 }}>
              PREFERRED DATE (OPTIONAL)
            </p>
          </div>
          <PickupDatePicker selection={mailInDate} onConfirm={onChangeMailInDate} mode="date" label="mail-in" />
        </>
      )}

      <button
        type="button"
        className="landing-btn-primary booking-page-continue-btn"
        onClick={() => {
          if (problem) {
            setAttempted(true);
            return;
          }
          onContinue();
        }}
        aria-describedby={showWarning ? "schedule-step-warning" : undefined}
      >
        Continue to your info
        <ArrowRight size={14} aria-hidden="true" />
      </button>
      {showWarning && (
        <p className="booking-page-form-warning" id="schedule-step-warning" role="status" aria-live="polite">
          <TriangleAlert size={14} aria-hidden="true" />
          {problem}
        </p>
      )}
    </>
  );
}

// Mirrors submitOrder's address/schedule rules so the customer finds out
// here, not after uploading photos at the Review step.
function scheduleProblem(
  method: ScheduleMethod,
  address: PickupAddress,
  pickupSelection: PickupSelection | null,
): string | null {
  if (!address.address.trim() || !address.city.trim() || !address.state) {
    return "Enter your street address, city and state to continue.";
  }
  if (!isValidZip(address.zip)) return "Enter a valid 5-digit zip code to continue.";
  if (method === "pickup") {
    if (!(PICKUP_STATES as readonly string[]).includes(address.state)) {
      return "Local Drop-Off is only available in NY, NJ and CT. Choose Mail-In instead.";
    }
    if (!pickupSelection) return "Choose a collection date and time to continue.";
    // The picker only offers bookable slots, but one can lapse while the
    // customer fills in the form (same-day notice, #75).
    if (!availablePickupSlots(calendarDateInLocalTime(pickupSelection.date), new Date()).includes(pickupSelection.time)) {
      return `That collection time is no longer available (same-day collections need ${PICKUP_LEAD_MINUTES / 60} hours' notice). Choose another.`;
    }
  }
  return null;
}
