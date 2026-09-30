"use client";

import { CalendarBlankIcon, CaretDownIcon, CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { addDays, calendarDateToUtcMidnight, dayOfWeek, type CalendarDate } from "@/features/orders/calendar-date";
import { usePopover } from "@/shared/ui/use-popover";
import {
  MAX_CUSTOM_RANGE_DAYS,
  OVERVIEW_PRESET_IDS,
  OVERVIEW_RANGE_LABELS,
  overviewHref,
  rangeDays,
  type OverviewPresetId,
  type OverviewSelection,
} from "./overview-range";

/** What's picked in the popover but not applied yet: a preset, or custom days (`to` null until the second click). */
type Draft = { preset: OverviewPresetId } | { preset: null; from: CalendarDate | null; to: CalendarDate | null };

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const monthTitle = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const fullDay = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

const firstOfMonth = (date: CalendarDate): CalendarDate => `${date.slice(0, 7)}-01`;
const nextMonth = (month: CalendarDate): CalendarDate => firstOfMonth(addDays(month, 32));
const previousMonth = (month: CalendarDate): CalendarDate => firstOfMonth(addDays(month, -1));
const daysBetween = (from: CalendarDate, to: CalendarDate) =>
  Math.round((calendarDateToUtcMidnight(to).getTime() - calendarDateToUtcMidnight(from).getTime()) / 86_400_000);

function draftFrom(selection: OverviewSelection): Draft {
  return typeof selection === "object" ? { preset: null, ...selection } : { preset: selection };
}

/** The days a draft covers, for the calendar to highlight. */
function draftDays(draft: Draft, today: CalendarDate): CalendarDate[] {
  if (draft.preset) return rangeDays(draft.preset, today);
  if (!draft.from) return [];
  return draft.to ? rangeDays({ from: draft.from, to: draft.to }, today) : [draft.from];
}

/**
 * The Overview's one date-range control: it scopes every figure on the
 * page, so they always agree. Presets on the left, a month calendar on
 * the right: a preset highlights its days, and two clicks pick a custom
 * range. Nothing changes until Apply, which navigates to the range's URL
 * (`?range=` or `?from=&to=`), so the range survives a reload and can be
 * bookmarked. `today` comes from the server, so the calendar and the
 * page agree on the shop's day.
 */
export function RangePicker({ selection, today, datesLabel }: { selection: OverviewSelection; today: CalendarDate; datesLabel: string }) {
  const { open, setOpen, toggle, rootRef } = usePopover<HTMLDivElement>();
  const router = useRouter();
  const panelId = useId();
  const monthId = useId();
  const gridRef = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);

  const [draft, setDraft] = useState<Draft>(() => draftFrom(selection));
  const [month, setMonth] = useState(() => firstOfMonth(draftDays(draftFrom(selection), today).at(-1) ?? today));
  const [focusDate, setFocusDate] = useState<CalendarDate>(today);

  const days = draftDays(draft, today);
  const first = days[0];
  const last = days.at(-1);
  const picking = !draft.preset && draft.from !== null && draft.to === null;
  const complete = draft.preset !== null || (draft.from !== null && draft.to !== null);
  const currentLabel = typeof selection === "object" ? OVERVIEW_RANGE_LABELS.custom : OVERVIEW_RANGE_LABELS[selection];

  /** Future days can't be reported on, and a second click can't stretch a range past the longest allowed. */
  function isDisabled(date: CalendarDate): boolean {
    if (date > today) return true;
    if (picking && !draft.preset) return Math.abs(daysBetween(draft.from!, date)) >= MAX_CUSTOM_RANGE_DAYS;
    return false;
  }

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`)?.focus();
  }, [focusDate, month]);

  function toggleOpen() {
    // Opening starts from what's applied, so a cancelled pick never lingers.
    if (!open) reset();
    toggle();
  }

  function reset() {
    const applied = draftFrom(selection);
    setDraft(applied);
    setMonth(firstOfMonth(draftDays(applied, today).at(-1) ?? today));
  }

  function pickPreset(id: OverviewPresetId) {
    setDraft({ preset: id });
    const end = rangeDays(id, today).at(-1)!;
    setMonth(firstOfMonth(end));
    setFocusDate(end);
  }

  function pickDay(date: CalendarDate) {
    setFocusDate(date);
    if (picking && !draft.preset) {
      const from = draft.from!;
      setDraft(date < from ? { preset: null, from: date, to: from } : { preset: null, from, to: date });
    } else {
      setDraft({ preset: null, from: date, to: null });
    }
  }

  function onGridKeyDown(event: React.KeyboardEvent) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const target = addDays(tabStop, step);
    if (isDisabled(target)) return;
    moveFocus.current = true;
    setFocusDate(target);
    setMonth(firstOfMonth(target));
  }

  function apply() {
    if (!complete) return;
    const chosen: OverviewSelection = draft.preset ?? { from: first!, to: last! };
    setOpen(false);
    router.push(overviewHref(chosen), { scroll: false });
  }

  function cancel() {
    setOpen(false);
    reset();
  }

  // The day the arrow keys start from: the last one focused if it's on screen, else the month's first open day.
  const monthDays = Array.from({ length: daysBetween(month, nextMonth(month)) }, (_, i) => addDays(month, i));
  const tabStop = monthDays.includes(focusDate) && !isDisabled(focusDate) ? focusDate : (monthDays.find((date) => !isDisabled(date)) ?? month);

  return (
    <div className="ov-range" ref={rootRef}>
      <button type="button" className="ov-range-button" aria-expanded={open} aria-controls={panelId} onClick={toggleOpen}>
        <CalendarBlankIcon size={18} aria-hidden="true" />
        <span>
          <span className="sr-only">{currentLabel}, </span>
          {datesLabel}
        </span>
        <CaretDownIcon size={14} weight="bold" aria-hidden="true" />
      </button>
      <div id={panelId} className="admin-popover ov-range-panel" role="group" aria-label="Choose a date range" hidden={!open}>
        <div className="ov-range-body">
          <div className="ov-range-presets">
            {OVERVIEW_PRESET_IDS.map((id) => (
              <button key={id} type="button" className="ov-range-preset" aria-pressed={draft.preset === id} onClick={() => pickPreset(id)}>
                {OVERVIEW_RANGE_LABELS[id]}
              </button>
            ))}
            <button
              type="button"
              className="ov-range-preset"
              aria-pressed={draft.preset === null}
              onClick={() => draft.preset && setDraft({ preset: null, from: null, to: null })}
            >
              {OVERVIEW_RANGE_LABELS.custom} Range
            </button>
          </div>

          <div className="ov-cal">
            <div className="ov-cal-head">
              <h3 id={monthId} className="ov-cal-title" aria-live="polite">
                {monthTitle.format(calendarDateToUtcMidnight(month))}
              </h3>
              <button type="button" className="ov-cal-nav" aria-label="Previous month" onClick={() => setMonth(previousMonth(month))}>
                <CaretLeftIcon size={16} weight="bold" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="ov-cal-nav"
                aria-label="Next month"
                disabled={nextMonth(month) > today}
                onClick={() => setMonth(nextMonth(month))}
              >
                <CaretRightIcon size={16} weight="bold" aria-hidden="true" />
              </button>
            </div>
            <div className="ov-cal-weekdays" aria-hidden="true">
              {WEEKDAYS.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>
            <div className="ov-cal-grid" ref={gridRef} role="group" aria-labelledby={monthId} onKeyDown={onGridKeyDown}>
              {Array.from({ length: dayOfWeek(month) }, (_, i) => (
                <span key={`blank-${i}`} />
              ))}
              {monthDays.map((date) => {
                const inRange = first !== undefined && last !== undefined && date >= first && date <= last;
                const edge = inRange && (date === first ? "start" : date === last ? "end" : undefined);
                return (
                  <button
                    key={date}
                    type="button"
                    className="ov-cal-day"
                    data-date={date}
                    data-state={edge ?? (inRange ? "between" : undefined)}
                    data-today={date === today ? "true" : undefined}
                    aria-label={fullDay.format(calendarDateToUtcMidnight(date))}
                    aria-pressed={inRange}
                    disabled={isDisabled(date)}
                    tabIndex={date === tabStop ? 0 : -1}
                    onClick={() => pickDay(date)}
                  >
                    {Number(date.slice(8))}
                  </button>
                );
              })}
            </div>
            <p className="ov-cal-hint" aria-live="polite">
              {complete ? "" : picking ? "Now pick the last day." : "Pick the first and last day."}
            </p>
          </div>
        </div>
        <div className="ov-range-actions">
          <button type="button" className="admin-btn" data-variant="secondary" onClick={cancel}>
            Cancel
          </button>
          <button type="button" className="admin-btn" disabled={!complete} onClick={apply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
