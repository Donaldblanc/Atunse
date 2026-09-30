import Link from "next/link";
import type { Icon } from "@phosphor-icons/react";

/** One row of the Overview's Needs Attention card: a link to its panel, or plain when there is none yet (sample data). */
export function AttentionItem({
  tone,
  icon: Icon,
  title,
  detail,
  count,
  href,
  sampleTag,
}: {
  tone: "red" | "orange" | "blue" | "violet" | "gray";
  icon: Icon;
  title: string;
  detail: string;
  count: number;
  /** The panel it opens (`?attention=…`). Left out for sample data, which has nothing to open. */
  href?: string;
  /** Shown beside the count when the count is sample data, not real. */
  sampleTag?: React.ReactNode;
}) {
  const content = (
    <>
      <span className="ov-attention-icon" data-tone={tone} aria-hidden="true">
        <Icon size={22} />
      </span>
      <span className="ov-attention-text">
        <strong>{title}</strong>
        <span>{detail}</span>
      </span>
      {sampleTag}
      <span className="ov-attention-count" data-alert={tone === "red" && count > 0 ? "true" : undefined}>
        {count}
      </span>
    </>
  );
  return (
    <li>
      {href ? (
        <Link className="ov-attention-item" data-link="true" href={href} scroll={false}>
          {content}
        </Link>
      ) : (
        <div className="ov-attention-item">{content}</div>
      )}
    </li>
  );
}
