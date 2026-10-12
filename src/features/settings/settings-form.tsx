"use client";

import { useActionState } from "react";
import { saveSettingsAction, type SaveSettingsState } from "./settings-actions";
import type { BusinessSettingsData, OperatingHoursRow } from "./repositories/settings-repository";

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toClock(minutes: number): string {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

const INITIAL: SaveSettingsState = { error: null, errors: {}, saved: 0 };

/**
 * Business Information, Operating Hours and Booking Settings, saved by one
 * Save Changes (saveSettingsAction). Booking Settings toggling doesn't yet
 * change /booking's behavior (docs/TODO.md #181) — the hint under them says so.
 */
export function SettingsForm({ business, hours, idempotencyKey }: { business: BusinessSettingsData; hours: OperatingHoursRow[]; idempotencyKey: string }) {
  const [state, formAction, pending] = useActionState<SaveSettingsState, FormData>(saveSettingsAction, INITIAL);
  const { errors } = state;

  return (
    <form action={formAction} className="st-form">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <section id="business-information" className="ov-card st-card">
        <h2 className="ov-card-title">Business Information</h2>
        <div className="st-grid">
          <Field label="Business name" error={errors.businessName}>
            <input name="businessName" defaultValue={business.businessName} maxLength={120} required className="st-input" />
          </Field>
          <Field label="Tagline">
            <input name="tagline" defaultValue={business.tagline ?? ""} maxLength={160} className="st-input" />
          </Field>
          <Field label="Owner name">
            <input name="ownerName" defaultValue={business.ownerName ?? ""} maxLength={120} className="st-input" />
          </Field>
          <Field label="Email" error={errors.email}>
            <input type="email" name="email" defaultValue={business.email ?? ""} maxLength={254} className="st-input" />
          </Field>
          <Field label="Phone">
            <input type="tel" name="phone" defaultValue={business.phone ?? ""} maxLength={30} className="st-input" />
          </Field>
          <Field label="Address line 1">
            <input name="addressLine1" defaultValue={business.addressLine1 ?? ""} maxLength={120} className="st-input" />
          </Field>
          <Field label="Address line 2">
            <input name="addressLine2" defaultValue={business.addressLine2 ?? ""} maxLength={120} className="st-input" />
          </Field>
          <Field label="City">
            <input name="city" defaultValue={business.city ?? ""} maxLength={80} className="st-input" />
          </Field>
          <Field label="State">
            <input name="state" defaultValue={business.state ?? ""} maxLength={2} className="st-input" />
          </Field>
          <Field label="Zip">
            <input name="zip" defaultValue={business.zip ?? ""} maxLength={10} className="st-input" />
          </Field>
          <Field label="Time zone" error={errors.timeZone}>
            <input name="timeZone" defaultValue={business.timeZone} maxLength={60} required className="st-input" placeholder="America/New_York" />
          </Field>
          <Field label="Currency" error={errors.currency}>
            <input name="currency" defaultValue={business.currency} maxLength={3} required className="st-input" placeholder="USD" />
          </Field>
        </div>
      </section>

      <section id="operating-hours" className="ov-card st-card">
        <h2 className="ov-card-title">Operating Hours</h2>
        <div className="st-hours-grid">
          {hours.map((row) => (
            <div key={row.weekday} className="st-hours-row">
              <label className="st-hours-day">
                <input type="hidden" name={`hours:${row.weekday}:weekday`} value={row.weekday} />
                <input type="checkbox" name={`hours:${row.weekday}:isOpen`} defaultChecked={row.isOpen} />
                {WEEKDAY_LABELS[row.weekday]}
              </label>
              <input type="time" name={`hours:${row.weekday}:opensAt`} defaultValue={toClock(row.opensAt)} className="st-input" />
              <span className="st-hours-sep">to</span>
              <input type="time" name={`hours:${row.weekday}:closesAt`} defaultValue={toClock(row.closesAt)} className="st-input" />
              {errors[`hours:${row.weekday}`] && (
                <p role="alert" className="od-status-error st-error">
                  {errors[`hours:${row.weekday}`]}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="ov-card st-card">
        <h2 className="ov-card-title">Booking Settings</h2>
        <p className="st-hint">
          These choose which Fulfillment Methods the booking flow offers once it reads Settings — it still reads its own schedule today, so a change here
          doesn&apos;t yet change what customers see on /booking.
        </p>
        <label className="st-toggle">
          <input type="checkbox" name="allowLocalDropOff" defaultChecked={business.allowLocalDropOff} />
          Allow Local Drop-Off bookings
        </label>
        <label className="st-toggle">
          <input type="checkbox" name="allowMailIn" defaultChecked={business.allowMailIn} />
          Allow Mail-In bookings
        </label>
      </section>

      {state.error && (
        <p role="alert" className="od-status-error">
          {state.error}
        </p>
      )}
      {state.saved > 0 && !state.error && Object.keys(errors).length === 0 && (
        <p role="status" className="st-saved">
          Saved.
        </p>
      )}

      <div className="st-actions">
        <button type="submit" className="admin-btn" disabled={pending}>
          {pending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="st-field">
      <label className="st-label">
        {label}
        {children}
      </label>
      {error && (
        <p role="alert" className="od-status-error st-error">
          {error}
        </p>
      )}
    </div>
  );
}
