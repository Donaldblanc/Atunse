"use client";

import { useActionState, useState } from "react";
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

  // Controlled so React 19's post-action form reset doesn't wipe what the
  // admin typed when validation fails.
  const [values, setValues] = useState({
    businessName: business.businessName,
    tagline: business.tagline ?? "",
    ownerName: business.ownerName ?? "",
    email: business.email ?? "",
    phone: business.phone ?? "",
    addressLine1: business.addressLine1 ?? "",
    addressLine2: business.addressLine2 ?? "",
    city: business.city ?? "",
    state: business.state ?? "",
    zip: business.zip ?? "",
    timeZone: business.timeZone,
    currency: business.currency,
    allowLocalDropOff: business.allowLocalDropOff,
    allowMailIn: business.allowMailIn,
  });
  const [hoursValues, setHoursValues] = useState(hours.map((row) => ({ isOpen: row.isOpen, opensAt: toClock(row.opensAt), closesAt: toClock(row.closesAt) })));
  type TextField = Exclude<keyof typeof values, "allowLocalDropOff" | "allowMailIn">;
  const bind = (name: TextField) => ({ name, value: values[name], onChange: (event: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [name]: event.target.value }) });
  const setHour = (index: number, patch: Partial<(typeof hoursValues)[number]>) => setHoursValues(hoursValues.map((h, i) => (i === index ? { ...h, ...patch } : h)));

  return (
    <form action={formAction} className="st-form">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <section id="business-information" className="ov-card st-card">
        <h2 className="ov-card-title">Business Information</h2>
        <div className="st-grid">
          <Field label="Business name" error={errors.businessName}>
            <input {...bind("businessName")} maxLength={120} required className="st-input" />
          </Field>
          <Field label="Tagline">
            <input {...bind("tagline")} maxLength={160} className="st-input" />
          </Field>
          <Field label="Owner name">
            <input {...bind("ownerName")} maxLength={120} className="st-input" />
          </Field>
          <Field label="Email" error={errors.email}>
            <input type="email" {...bind("email")} maxLength={254} className="st-input" />
          </Field>
          <Field label="Phone" error={errors.phone}>
            <input type="tel" {...bind("phone")} maxLength={30} className="st-input" />
          </Field>
          <Field label="Address line 1">
            <input {...bind("addressLine1")} maxLength={120} className="st-input" />
          </Field>
          <Field label="Address line 2">
            <input {...bind("addressLine2")} maxLength={120} className="st-input" />
          </Field>
          <Field label="City">
            <input {...bind("city")} maxLength={80} className="st-input" />
          </Field>
          <Field label="State">
            <input {...bind("state")} maxLength={2} className="st-input" />
          </Field>
          <Field label="Zip">
            <input {...bind("zip")} maxLength={10} className="st-input" />
          </Field>
          <Field label="Time zone" error={errors.timeZone}>
            <input {...bind("timeZone")} maxLength={60} required className="st-input" placeholder="America/New_York" />
          </Field>
          <Field label="Currency" error={errors.currency}>
            <input {...bind("currency")} maxLength={3} required className="st-input" placeholder="USD" />
          </Field>
        </div>
      </section>

      <section id="operating-hours" className="ov-card st-card">
        <h2 className="ov-card-title">Operating Hours</h2>
        <p className="st-hint">These hours are saved but booking doesn&apos;t use them yet — /booking still reads its own schedule.</p>
        <div className="st-hours-grid">
          {hours.map((row, index) => {
            const hv = hoursValues[index];
            if (!hv) return null;
            return (
            <div key={row.weekday} className="st-hours-row">
              <label className="st-hours-day">
                <input type="hidden" name={`hours:${row.weekday}:weekday`} value={row.weekday} />
                <input type="checkbox" name={`hours:${row.weekday}:isOpen`} checked={hv.isOpen} onChange={(event) => setHour(index, { isOpen: event.target.checked })} />
                {WEEKDAY_LABELS[row.weekday]}
              </label>
              <input type="time" name={`hours:${row.weekday}:opensAt`} value={hv.opensAt} onChange={(event) => setHour(index, { opensAt: event.target.value })} className="st-input" />
              <span className="st-hours-sep">to</span>
              <input type="time" name={`hours:${row.weekday}:closesAt`} value={hv.closesAt} onChange={(event) => setHour(index, { closesAt: event.target.value })} className="st-input" />
              {errors[`hours:${row.weekday}`] && (
                <p role="alert" className="od-status-error st-error">
                  {errors[`hours:${row.weekday}`]}
                </p>
              )}
            </div>
            );
          })}
        </div>
      </section>

      <section className="ov-card st-card">
        <h2 className="ov-card-title">Booking Settings</h2>
        <p className="st-hint">
          These choose which Fulfillment Methods the booking flow offers once it reads Settings — it still reads its own schedule today, so a change here
          doesn&apos;t yet change what customers see on /booking.
        </p>
        <label className="st-toggle">
          <input type="checkbox" name="allowLocalDropOff" checked={values.allowLocalDropOff} onChange={(event) => setValues({ ...values, allowLocalDropOff: event.target.checked })} />
          Allow Local Drop-Off bookings
        </label>
        <label className="st-toggle">
          <input type="checkbox" name="allowMailIn" checked={values.allowMailIn} onChange={(event) => setValues({ ...values, allowMailIn: event.target.checked })} />
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
