import { calendarDateToUtcMidnight, type CalendarDate } from "@/features/orders/calendar-date";

const longDay = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
const shortDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const asDate = calendarDateToUtcMidnight;

/**
 * One measure per day of the range as a line over a light area fill, in the
 * first series colour (one series, so no legend: the dialog names it). The
 * line stops at `through` (today, for a range still in progress), so days
 * still to come don't read as zeros; that last day is the highlighted point.
 *
 * The line is stretched SVG (so it fills any width) with non-scaling strokes;
 * everything that must stay round or readable, the points and every label,
 * is HTML positioned by percentage. Each day is a focusable column that
 * shows its value on hover and focus and names it for screen readers.
 */
export function MetricChart({
  days,
  through,
  ticks,
  formatTick,
  describe,
}: {
  days: { date: CalendarDate; value: number }[];
  /** The last day with figures: today for a range in progress, else the range's last day. */
  through: CalendarDate;
  /** Ascending, from 0; the last is the top of the axis. */
  ticks: number[];
  formatTick: (tick: number) => string;
  /** "3 orders": one day's value in words, for the tooltip and screen readers. */
  describe: (value: number) => string;
}) {
  const top = ticks[ticks.length - 1]!;
  const everyDay = days.length <= 7;
  const x = (i: number) => ((i + 0.5) / days.length) * 100;
  const y = (value: number) => 100 - (value / top) * 100;
  const last = Math.max(0, days.findLastIndex((day) => day.date <= through));
  const line = days
    .slice(0, last + 1)
    .map((day, i) => `${x(i)},${y(day.value)}`)
    .join(" ");
  const area = `${x(0)},100 ${line} ${x(last)},100`;

  return (
    <div className="md-chart">
      <div className="md-chart-axis" aria-hidden="true">
        {[...ticks].reverse().map((tick) => (
          <span key={tick}>{formatTick(tick)}</span>
        ))}
      </div>
      <div className="md-chart-plot">
        <div className="md-chart-grid" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} />
          ))}
        </div>
        <svg className="md-chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polygon className="md-chart-area" points={area} />
          <polyline className="md-chart-line" points={line} vectorEffect="non-scaling-stroke" />
        </svg>
        {days.map((day, i) => (
          <div
            key={day.date}
            className="md-chart-hit"
            style={{ left: `${(i / days.length) * 100}%`, width: `${100 / days.length}%` }}
            role="img"
            tabIndex={0}
            aria-label={`${longDay.format(asDate(day.date))}: ${i > last ? "still to come" : describe(day.value)}`}
          >
            {i <= last && (
              <>
                <span className="md-chart-dot" data-highlight={i === last ? "true" : undefined} style={{ top: `${y(day.value)}%` }} />
                <span className="ov-tooltip md-chart-tooltip" style={{ top: `${y(day.value)}%` }} aria-hidden="true">
                  <strong>{describe(day.value)}</strong>
                  <span>{shortDay.format(asDate(day.date))}</span>
                </span>
              </>
            )}
          </div>
        ))}
        <div className="md-chart-labels" aria-hidden="true">
          {days.map((day, i) => {
            // A week labels every day; a longer range every fifth counting back from its last day.
            const labelled = everyDay || (days.length - 1 - i) % 5 === 0;
            return (
              labelled && (
                <span key={day.date} style={{ left: `${x(i)}%` }}>
                  {(everyDay ? weekday : shortDay).format(asDate(day.date))}
                </span>
              )
            );
          })}
        </div>
      </div>
    </div>
  );
}
