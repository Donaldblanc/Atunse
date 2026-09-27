"use client";

import { useState } from "react";
import { ArrowRight, Info, Package, Truck, TriangleAlert } from "lucide-react";
import { PickupDatePicker, type PickupSelection } from "./pickup-date-picker";
import type { PickupAddress, ScheduleMethod } from "./booking-types";
import { isValidZip } from "./contact-rules";
import { PICKUP_STATES, US_STATES } from "./pickup-window";

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
        <h2>Pickup or mail in?</h2>
        <p>Choose how you&rsquo;d like to get your sneakers to us.</p>
      </div>

      <div className="booking-page-shipping-grid">
        <button type="button" className="booking-page-shipping-card" data-active={method === "pickup"} onClick={() => onSelectMethod("pickup")}>
          <Truck size={20} aria-hidden="true" />
          <span>
            <strong>Pickup</strong>
            <span>We&rsquo;ll collect your sneakers from your address.</span>
          </span>
        </button>
        <button type="button" className="booking-page-shipping-card" data-active={method === "mail-in"} onClick={() => onSelectMethod("mail-in")}>
          <Package size={20} aria-hidden="true" />
          <span>
            <strong>Mail in</strong>
            <span>We&rsquo;ll email you where to ship after checkout.</span>
          </span>
        </button>
      </div>

      <div className="booking-page-section-head booking-page-section-head-tight">
        <p className="booking-page-step-eyebrow" style={{ margin: 0 }}>
          {method === "pickup" ? "PICKUP ADDRESS" : "SHIPPING ADDRESS"}
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
              PICKUP DATE
            </p>
          </div>
          <PickupDatePicker selection={pickupSelection} onConfirm={onConfirmPickup} />

          <div className="booking-page-info-box">
            <Info size={16} aria-hidden="true" />
            <span>
              Available pickup times are between
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
      return "Pickup is only available in NY, NJ and CT. Choose Mail in instead.";
    }
    if (!pickupSelection) return "Choose a pickup date and time to continue.";
  }
  return null;
}
