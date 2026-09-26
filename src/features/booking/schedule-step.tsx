"use client";

import { ArrowRight, Info, Package, Truck } from "lucide-react";
import { PickupDatePicker, type PickupSelection } from "./pickup-date-picker";
import type { PickupAddress, ScheduleMethod } from "./booking-types";

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
  return (
    <>
      <div className="booking-page-section-head">
        <p className="booking-page-step-eyebrow">STEP 3 OF 4</p>
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
            <span>We&rsquo;ll send you a prepaid label after checkout.</span>
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
            <option>NY</option>
            <option>NJ</option>
            <option>CT</option>
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

      <button type="button" className="landing-btn-primary booking-page-continue-btn" onClick={onContinue}>
        Continue to review
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </>
  );
}
