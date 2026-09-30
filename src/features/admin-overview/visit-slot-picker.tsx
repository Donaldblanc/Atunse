"use client";

import { adminVisitSlots } from "@/features/orders/pickup-window";
import { isCalendarDate, shopClock } from "@/features/orders/calendar-date";

/** "8:00 AM – 8:30 AM" -> "8:00 AM": a button only needs the start; the range is in its accessible name. */
export function slotStartLabel(slot: string): string {
  return slot.split(" – ")[0] ?? slot;
}

/**
 * A date and the slots open on it, for the owner booking a visit
 * (rescheduling, or a Return). Controlled: the parent form owns
 * `date`/`slot` and submits them. Slot rules come from adminVisitSlots
 * (pickup-window.ts), the same grid booking uses; this file carries no
 * customer copy. `now` is passed from the server so the first render agrees
 * with it. The date is a native date input (keyboard and screen-reader
 * friendly) and the slots are radios drawn as 44px buttons, so arrow keys
 * move between them and a focus ring shows where you are.
 */
export function VisitSlotPicker({
  date,
  slot,
  onChange,
  now,
  idPrefix,
}: {
  date: string;
  slot: string;
  onChange: (next: { date: string; slot: string }) => void;
  /** ISO instant, the server's "now". */
  now: string;
  idPrefix: string;
}) {
  const nowDate = new Date(now);
  const today = shopClock(nowDate).date;
  const slots = isCalendarDate(date) ? adminVisitSlots(date, nowDate) : [];

  return (
    <div className="vsp">
      <div className="vsp-field">
        <label htmlFor={`${idPrefix}-date`} className="vsp-label">
          Date
        </label>
        <input
          id={`${idPrefix}-date`}
          type="date"
          className="vsp-date"
          value={date}
          min={today}
          required
          // A slot chosen for another day may not exist on this one, so a new date starts with none picked.
          onChange={(event) => onChange({ date: event.target.value, slot: "" })}
        />
      </div>

      <fieldset className="vsp-slots">
        <legend className="vsp-label">Time</legend>
        {slots.length === 0 ? (
          <p className="vsp-empty" role="status">
            {isCalendarDate(date) ? "No times are left on this day. Pick another date." : "Pick a date to see times."}
          </p>
        ) : (
          <div className="vsp-grid">
            {slots.map((option) => (
              <label key={option} className="vsp-slot">
                <input type="radio" name={`${idPrefix}-slot`} value={option} checked={slot === option} onChange={() => onChange({ date, slot: option })} />
                <span aria-label={option}>{slotStartLabel(option)}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </div>
  );
}
