"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { calendarDateToUtcMidnight } from "@/features/orders/calendar-date";
import { bookReturnVisitAction, rescheduleVisitAction, type ScheduleVisitState } from "./visit-schedule-actions";
import { VisitSlotPicker } from "./visit-slot-picker";

const dayFormat = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

/** "2026-10-08" -> "Thursday, October 8". */
function dayLabel(date: string): string {
  return dayFormat.format(calendarDateToUtcMidnight(date));
}

/**
 * The picker plus a confirm step for both ways of scheduling a visit:
 * rescheduling one, and booking a Return. Saving emails the customer, so
 * "Review" only shows what will happen; the email goes out on "Confirm and
 * email customer". `hidden` carries the ids and the Overview range the
 * server action needs. Shared by both dialogs, so they behave alike.
 */
export function VisitScheduleForm({
  mode,
  hidden,
  customer,
  now,
  initialDate,
  currentStartsAt,
  cancelHref,
}: {
  mode: "reschedule" | "return";
  hidden: Record<string, string>;
  customer: { name: string; email: string };
  now: string;
  initialDate: string;
  /** Rescheduling: the visit's own start, which the picker leaves out. */
  currentStartsAt?: string;
  cancelHref: string;
}) {
  const action = mode === "reschedule" ? rescheduleVisitAction : bookReturnVisitAction;
  const [state, formAction, pending] = useActionState<ScheduleVisitState, FormData>(action, { error: null });
  const [choice, setChoice] = useState({ date: initialDate, slot: "" });
  const [confirming, setConfirming] = useState(false);

  if (state.warning) {
    return (
      <div className="vsf">
        <p className="vsf-warning" role="alert">
          {state.warning}
        </p>
        <div className="vsf-actions">
          <Link className="admin-btn" href={state.doneHref ?? cancelHref} replace scroll={false}>
            Done
          </Link>
        </div>
      </div>
    );
  }

  const verb = mode === "reschedule" ? "Move visit" : "Book return visit";
  return (
    <form
      action={formAction}
      className="vsf"
      // Enter in the date field submits the form; save only from the confirm step.
      onSubmit={(event) => {
        if (confirming) return;
        event.preventDefault();
        if (choice.slot) setConfirming(true);
      }}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input type="hidden" name="date" value={choice.date} />
      <input type="hidden" name="slot" value={choice.slot} />

      {confirming ? (
        <div className="vsf-confirm">
          <p>
            {mode === "reschedule" ? "Move this visit to" : "Book DJ to drop the sneakers back off on"} <strong>
              {dayLabel(choice.date)}, {choice.slot}
            </strong>?
          </p>
          <p className="vsf-note">
            {customer.name} will get an email at {customer.email} with the {mode === "reschedule" ? "new" : ""} time.
          </p>
        </div>
      ) : (
        <VisitSlotPicker
          idPrefix={`vsf-${mode}`}
          now={now}
          date={choice.date}
          slot={choice.slot}
          onChange={setChoice}
          currentStartsAt={currentStartsAt}
        />
      )}

      {state.error && (
        <p role="alert" className="vsf-error">
          {state.error}
        </p>
      )}

      <div className="vsf-actions">
        {confirming ? (
          <>
            {/* Keyed apart from the review button: reused in place, the click that swaps them would also submit. */}
            <button key="confirm" type="submit" className="admin-btn" disabled={pending}>
              {pending ? "Saving…" : "Confirm and email customer"}
            </button>
            <button type="button" className="admin-btn" data-variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>
              Change time
            </button>
          </>
        ) : (
          <>
            <button key="review" type="button" className="admin-btn" disabled={!choice.slot} onClick={() => setConfirming(true)}>
              {verb}…
            </button>
            <Link className="admin-btn" data-variant="secondary" href={cancelHref} replace scroll={false}>
              Cancel
            </Link>
          </>
        )}
      </div>
    </form>
  );
}
