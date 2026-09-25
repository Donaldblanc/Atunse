"use client";

import { ArrowRight, Calendar, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { useState } from "react";

export type PickupSelection = { date: Date; time: string };
export type PickupPickerMode = "datetime" | "date";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Pickup window: 4:30 PM - 10:00 PM in 30-minute slots.
const WINDOW_START_MINUTES = 16 * 60 + 30;
const WINDOW_END_MINUTES = 22 * 60;

export function formatDate(date: Date) {
  return `${WEEKDAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function formatClock(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m === 0 ? "00" : m} ${period}`;
}

function buildTimeSlots() {
  const slots: string[] = [];
  for (let start = WINDOW_START_MINUTES; start < WINDOW_END_MINUTES; start += 30) {
    slots.push(`${formatClock(start)} – ${formatClock(start + 30)}`);
  }
  return slots;
}

type CalendarCell = { day: number; date: Date | null; outside: boolean; disabled: boolean };

function buildCalendarCells(year: number, month: number) {
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const cells: CalendarCell[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, date: null, outside: true, disabled: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    cells.push({ day: d, date, outside: false, disabled: date < todayMidnight });
  }
  let nextMonthDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ day: nextMonthDay++, date: null, outside: true, disabled: true });
  }
  return cells;
}

export function PickupDatePicker({
  selection,
  onConfirm,
  mode = "datetime",
  label = "pickup",
}: {
  selection: PickupSelection | null;
  onConfirm: (selection: PickupSelection) => void;
  mode?: PickupPickerMode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"calendar" | "time">("calendar");
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [pendingDate, setPendingDate] = useState<Date | null>(selection?.date ?? null);
  const [pendingTime, setPendingTime] = useState<string | null>(selection?.time ?? null);

  function openModal() {
    const base = selection?.date ?? today;
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setPendingDate(selection?.date ?? null);
    setPendingTime(selection?.time ?? null);
    setView("calendar");
    setOpen(true);
  }

  function stepMonth(delta: number) {
    let month = viewMonth + delta;
    let year = viewYear;
    if (month < 0) {
      month = 11;
      year -= 1;
    } else if (month > 11) {
      month = 0;
      year += 1;
    }
    setViewMonth(month);
    setViewYear(year);
  }

  const cells = buildCalendarCells(viewYear, viewMonth);
  const timeSlots = buildTimeSlots();

  return (
    <>
      <button type="button" className="booking-page-picker-row" onClick={openModal}>
        <Calendar size={16} aria-hidden="true" />
        <span>
          {selection ? (mode === "date" ? formatDate(selection.date) : `${formatDate(selection.date)} · ${selection.time}`) : "Select a date"}
        </span>
        <ChevronRight size={14} className="booking-page-picker-chevron" aria-hidden="true" />
      </button>

      {open && (
        <>
          <div className="booking-page-modal-backdrop" onClick={() => setOpen(false)} />
          <div className="booking-page-modal">
            <div className="booking-page-modal-sheet-handle" />

            {view === "calendar" ? (
              <>
                <div className="booking-page-modal-head">
                  <div>
                    <h3>Select a {label} date</h3>
                    <p>Choose a date that works best for you. We only show available dates.</p>
                  </div>
                  <button type="button" className="booking-page-modal-close" onClick={() => setOpen(false)} aria-label="Close">
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>

                <div className="booking-page-calendar-nav">
                  <button type="button" className="booking-page-calendar-nav-btn" onClick={() => stepMonth(-1)} aria-label="Previous month">
                    <ChevronLeft size={14} aria-hidden="true" />
                  </button>
                  <strong>
                    {MONTH_NAMES[viewMonth]} {viewYear}
                  </strong>
                  <button type="button" className="booking-page-calendar-nav-btn" onClick={() => stepMonth(1)} aria-label="Next month">
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                </div>
                <div className="booking-page-calendar-weekdays">
                  {WEEKDAY_SHORT.map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className="booking-page-calendar-grid">
                  {cells.map((cell, index) => (
                    <button
                      type="button"
                      key={index}
                      className="booking-page-calendar-day"
                      data-outside={cell.outside}
                      data-disabled={cell.disabled}
                      data-active={!!(pendingDate && cell.date && cell.date.getTime() === pendingDate.getTime())}
                      disabled={cell.disabled}
                      onClick={() => cell.date && setPendingDate(cell.date)}
                    >
                      {cell.day}
                    </button>
                  ))}
                </div>

                {mode === "datetime" && (
                  <div className="booking-page-info-box">
                    <Clock size={16} aria-hidden="true" />
                    <span>
                      Pickup times are available from
                      <br />
                      <strong>4:30 PM &ndash; 10:00 PM.</strong>
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  className="landing-btn-primary booking-page-continue-btn"
                  disabled={!pendingDate}
                  onClick={() => {
                    if (mode === "date") {
                      if (!pendingDate) return;
                      onConfirm({ date: pendingDate, time: "" });
                      setOpen(false);
                      return;
                    }
                    setView("time");
                  }}
                >
                  {mode === "date" ? "Confirm date" : "Next: Select a time"}
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </>
            ) : (
              <>
                <div className="booking-page-modal-head">
                  <h3>Select a pickup time</h3>
                  <button type="button" className="booking-page-modal-close" onClick={() => setOpen(false)} aria-label="Close">
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>

                <div className="booking-page-time-date-row">
                  <Calendar size={16} aria-hidden="true" />
                  <strong>{pendingDate && formatDate(pendingDate)}</strong>
                  <button type="button" className="booking-page-time-change-btn" onClick={() => setView("calendar")}>
                    Change
                  </button>
                </div>
                <p className="booking-page-time-caption">Available pickup times are between 4:30 PM &ndash; 10:00 PM.</p>

                <div className="booking-page-time-list">
                  {timeSlots.map((slot) => (
                    <button
                      type="button"
                      key={slot}
                      className="booking-page-time-slot"
                      data-active={pendingTime === slot}
                      onClick={() => setPendingTime(slot)}
                    >
                      <span className="booking-page-time-radio" aria-hidden="true" />
                      {slot}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="landing-btn-primary booking-page-continue-btn"
                  disabled={!pendingDate || !pendingTime}
                  onClick={() => {
                    if (!pendingDate || !pendingTime) return;
                    onConfirm({ date: pendingDate, time: pendingTime });
                    setOpen(false);
                  }}
                >
                  Confirm Pickup Time
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
