"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import type { ContactInfo } from "./booking-types";

// Captures the order's contact info — previously nowhere in this flow,
// which meant the review step always showed a hardcoded "John Doe" /
// "john@example.com" placeholder (docs/TODO.md). Name/email/phone are
// required; rush is an optional +$20 add-on.
export function ContactStep({
  contact,
  onChangeContact,
  rush,
  onChangeRush,
  onContinue,
}: {
  contact: ContactInfo;
  onChangeContact: (contact: ContactInfo) => void;
  rush: boolean;
  onChangeRush: (rush: boolean) => void;
  onContinue: () => void;
}) {
  const isValid = Boolean(contact.name.trim() && contact.email.trim() && contact.phone.trim());

  return (
    <>
      <div className="booking-page-section-head">
        <p className="booking-page-step-eyebrow">STEP 4 OF 5</p>
        <h2>Your info.</h2>
        <p>Who should we contact about this order?</p>
      </div>

      <div className="booking-page-form-grid">
        <label className="booking-page-field">
          <span>Full name</span>
          <input
            type="text"
            placeholder="e.g. Jordan Smith"
            value={contact.name}
            onChange={(e) => onChangeContact({ ...contact, name: e.target.value })}
            required
          />
        </label>
      </div>
      <div className="booking-page-form-grid">
        <label className="booking-page-field">
          <span>Email</span>
          <input
            type="email"
            placeholder="e.g. jordan@email.com"
            value={contact.email}
            onChange={(e) => onChangeContact({ ...contact, email: e.target.value })}
            required
          />
        </label>
        <label className="booking-page-field">
          <span>Phone</span>
          <input
            type="tel"
            placeholder="e.g. (123) 456-7890"
            value={contact.phone}
            onChange={(e) => onChangeContact({ ...contact, phone: e.target.value })}
            required
          />
        </label>
      </div>

      <div className="booking-page-section-head booking-page-section-head-tight">
        <p className="booking-page-step-eyebrow" style={{ margin: 0 }}>
          RUSH SERVICE (OPTIONAL)
        </p>
      </div>
      <button
        type="button"
        className="booking-page-shipping-card"
        style={{ width: "100%" }}
        data-active={rush}
        aria-pressed={rush}
        onClick={() => onChangeRush(!rush)}
      >
        <Sparkles size={20} aria-hidden="true" />
        <span>
          <strong>Add rush service &mdash; +$20</strong>
          <span>Cuts standard turnaround roughly in half.</span>
        </span>
      </button>

      <button
        type="button"
        className="landing-btn-primary booking-page-continue-btn"
        onClick={onContinue}
        disabled={!isValid}
        title={isValid ? undefined : "Name, email, and phone are required"}
      >
        Continue to review
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </>
  );
}
