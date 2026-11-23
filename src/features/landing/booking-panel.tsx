"use client";

import Link from "next/link";
import { MapPin, Clock, Tag, Package, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { ArrowIcon } from "./arrow-icon";

// The lowest price a pair can be booked at (the cheapest cleaning tier), from
// the same catalog the booking flow and the server's estimate use: the page
// passes it in as `fromPrice` (startingPrice in service-catalog.ts).

type BookingMode = "pickup" | "mail-in";

type BookingModeConfig = {
  label: string;
  rows: { icon: LucideIcon; title: string; subtitle?: string }[];
  cta: string;
  href: string;
};

function modes(fromPrice: string | null): Record<BookingMode, BookingModeConfig> {
  const FROM_PRICE = fromPrice ? `Pricing from ${fromPrice}` : "Transparent pricing";
  return {
  pickup: {
    label: "Local Drop-Off",
    rows: [
      { icon: MapPin, title: "NY / NJ / CT", subtitle: "DJ collects from your address and drops it back off" },
      { icon: Clock, title: "Cleanings typically take about 72 hours", subtitle: "Timelines are estimates" },
      { icon: Tag, title: FROM_PRICE, subtitle: "Final pricing based on condition and service" },
    ],
    cta: "View pricing & book now",
    href: "/booking?method=drop-off",
  },
  "mail-in": {
    label: "Mail-In",
    rows: [
      // ADR-0010: the customer arranges their own shipping; we don't send labels.
      { icon: Package, title: "Ships anywhere in the US", subtitle: "We'll email you where to send it, and ship it back" },
      { icon: Clock, title: "Typically 5–10 business days round trip", subtitle: "Estimated, including transit both ways" },
      { icon: Tag, title: FROM_PRICE, subtitle: "Final pricing based on condition and service" },
    ],
    cta: "Book a mail-in",
    href: "/booking?method=mail-in",
  },
  };
}

export function BookingPanel({ fromPrice }: { fromPrice: string | null }) {
  const [mode, setMode] = useState<BookingMode>("pickup");
  const MODES = modes(fromPrice);
  const config = MODES[mode];

  return (
    <div className="landing-booking" id="process">
      <h2>Booking &amp; Pricing</h2>
      <div className="landing-booking-toggle">
        {(Object.keys(MODES) as BookingMode[]).map((key) => (
          <button
            type="button"
            key={key}
            data-active={mode === key}
            aria-pressed={mode === key}
            onClick={() => setMode(key)}
          >
            {MODES[key].label}
          </button>
        ))}
      </div>

      {config.rows.map((row) => (
        <div className="landing-booking-row" key={row.title}>
          <span className="landing-booking-icon" aria-hidden="true">
            <row.icon size={16} />
          </span>
          <div>
            <strong>{row.title}</strong>
            {row.subtitle && <span>{row.subtitle}</span>}
          </div>
        </div>
      ))}
      <Link className="landing-btn-primary" href={config.href}>
        {config.cta}
        <ArrowIcon />
      </Link>
    </div>
  );
}
