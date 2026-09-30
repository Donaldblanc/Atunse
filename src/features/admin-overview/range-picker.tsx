"use client";

import { CalendarBlankIcon, CaretDownIcon, CheckIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useId } from "react";
import { usePopover } from "@/shared/ui/use-popover";
import { OVERVIEW_RANGE_IDS, OVERVIEW_RANGE_LABELS, type OverviewRangeId } from "./overview-range";

/**
 * The Overview's one date-range control: it scopes every figure on the
 * page, so they always agree. Each preset is a link (`?range=`), so the
 * range survives a reload and can be bookmarked.
 */
export function RangePicker({ current, datesLabel }: { current: OverviewRangeId; datesLabel: string }) {
  const { open, toggle, setOpen, rootRef } = usePopover<HTMLDivElement>();
  const panelId = useId();

  return (
    <div className="ov-range" ref={rootRef}>
      <button type="button" className="ov-range-button" aria-expanded={open} aria-controls={panelId} onClick={toggle}>
        <CalendarBlankIcon size={18} aria-hidden="true" />
        <span>
          <span className="sr-only">{OVERVIEW_RANGE_LABELS[current]}, </span>
          {datesLabel}
        </span>
        <CaretDownIcon size={14} weight="bold" aria-hidden="true" />
      </button>
      <div id={panelId} className="admin-popover ov-range-panel" hidden={!open}>
        {OVERVIEW_RANGE_IDS.map((id) => (
          <Link
            key={id}
            href={id === "this-week" ? "/admin" : `/admin?range=${id}`}
            className="admin-menu-item"
            aria-current={id === current ? "true" : undefined}
            onClick={() => setOpen(false)}
          >
            <span className="ov-range-check" aria-hidden="true">
              {id === current && <CheckIcon size={16} weight="bold" />}
            </span>
            {OVERVIEW_RANGE_LABELS[id]}
          </Link>
        ))}
      </div>
    </div>
  );
}
