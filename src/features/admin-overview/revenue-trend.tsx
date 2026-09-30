import { calendarDateToUtcMidnight, type CalendarDate } from "@/features/orders/calendar-date";
import type { Money } from "@/shared/money/money";
import { dollarTicks } from "./chart-scale";

const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const longDay = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
const shortDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const asDate = calendarDateToUtcMidnight;

/**
 * Booked revenue per day as bars, one series, so no legend: the card
 * title names it. The highlighted bar is today (or the range's last day).
 * Each bar is focusable and shows its value on hover and focus.
 */
export function RevenueTrend({ days, highlight }: { days: { date: CalendarDate; revenue: Money }[]; highlight: CalendarDate }) {
  const ticks = dollarTicks(Math.max(...days.map((day) => day.revenue.cents)) / 100);
  const top = ticks[ticks.length - 1]!;
  const everyDay = days.length <= 7;
  // Up to a month, every fifth day is labelled; beyond that (90 days, a
  // custom range) about six labels, so they never run into each other.
  const labelStep = days.length <= 31 ? 5 : Math.ceil(days.length / 6);
  // A bar per day past a month is a sliver: tighter gaps, and no tab stop
  // on each (hover still shows the value; every bar keeps its aria-label).
  const veryDense = days.length > 45;

  return (
    <div className="ov-bars" data-dense={everyDay ? undefined : veryDense ? "very" : "true"}>
      <div className="ov-bars-axis" aria-hidden="true">
        {[...ticks].reverse().map((tick) => (
          <span key={tick}>${tick.toLocaleString("en-US")}</span>
        ))}
      </div>
      <div className="ov-bars-plot">
        <div className="ov-bars-grid" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} />
          ))}
        </div>
        {days.map((day, i) => {
          const value = day.revenue.format();
          // Label every day in a week; otherwise every few, counting back from the last day.
          const labelled = everyDay || (days.length - 1 - i) % labelStep === 0;
          return (
            <div key={day.date} className="ov-bar-slot">
              <div
                className="ov-bar-hit"
                role="img"
                tabIndex={veryDense ? undefined : 0}
                aria-label={`${longDay.format(asDate(day.date))}: ${value} booked`}
              >
                <div
                  className="ov-bar"
                  data-highlight={day.date === highlight ? "true" : undefined}
                  style={{ height: `${(day.revenue.cents / 100 / top) * 100}%` }}
                >
                  <span className="ov-tooltip" aria-hidden="true">
                    <strong>{value}</strong>
                    <span>{shortDay.format(asDate(day.date))}</span>
                  </span>
                </div>
              </div>
              <span className="ov-bar-label" aria-hidden="true">
                {labelled ? (everyDay ? weekday.format(asDate(day.date)) : shortDay.format(asDate(day.date))) : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
