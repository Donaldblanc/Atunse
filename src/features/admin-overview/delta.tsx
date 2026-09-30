import { ArrowDownIcon, ArrowUpIcon } from "@phosphor-icons/react/dist/ssr";
import { percentChange } from "./get-admin-overview";

/** "↑ 20% vs same time last week": arrow and sign, not just color, say which way. */
export function Delta({ current, previous, comparison }: { current: number; previous: number; comparison: string }) {
  const change = percentChange(current, previous);
  if (change === null) {
    return <p className="ov-delta-line">Nothing to compare {comparison.replace(/^vs /, "with ")}</p>;
  }

  const tone = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const Arrow = change < 0 ? ArrowDownIcon : ArrowUpIcon;
  return (
    <p className="ov-delta-line">
      <span className="ov-delta" data-tone={tone}>
        {tone !== "flat" && <Arrow size={14} weight="bold" aria-hidden="true" />}
        <span className="sr-only">{tone === "up" ? "Up " : tone === "down" ? "Down " : ""}</span>
        {Math.abs(change)}%
      </span>
      {comparison}
    </p>
  );
}
