"use client";

import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr";
import { OPEN_RANGE_PICKER_EVENT } from "./range-picker-event";

/** The chart cards' range chip: it opens the Overview's one range picker, which scopes every card. */
export function RangeChip({ label }: { label: string }) {
  return (
    <button type="button" className="ov-chip cd-chip" aria-haspopup="true" onClick={() => window.dispatchEvent(new Event(OPEN_RANGE_PICKER_EVENT))}>
      <span className="sr-only">Change date range, currently </span>
      {label}
      <CaretDownIcon size={12} weight="bold" aria-hidden="true" />
    </button>
  );
}
