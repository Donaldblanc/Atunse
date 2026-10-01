import { ArrowDownIcon, ArrowUpIcon } from "@phosphor-icons/react/dist/ssr";
import { changeBadge } from "./get-admin-overview";

/** "↑ 20% vs same time last week": arrow and sign, not just color, say which way. */
export function Delta({ current, previous, comparison }: { current: number; previous: number; comparison: string }) {
  const badge = changeBadge(current, previous);
  if (badge === null) {
    return <p className="ov-delta-line">Nothing to compare {comparison.replace(/^vs /, "with ")}</p>;
  }

  const { tone, label } = badge;
  const Arrow = tone === "down" ? ArrowDownIcon : ArrowUpIcon;
  return (
    <p className="ov-delta-line">
      <span className="ov-delta" data-tone={tone}>
        {tone !== "flat" && <Arrow size={14} weight="bold" aria-hidden="true" />}
        <span className="sr-only">{tone === "up" ? "Up " : tone === "down" ? "Down " : ""}</span>
        {label}
      </span>
      {comparison}
    </p>
  );
}
