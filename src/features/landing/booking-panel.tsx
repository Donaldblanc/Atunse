"use client";

import Link from "next/link";
import { MapPin, Clock, Tag, Package, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { ArrowIcon } from "./arrow-icon";

type BookingMode = "in-person" | "mail-in";

type BookingModeConfig = {
  label: string;
  rows: { icon: LucideIcon; title: string; subtitle?: string }[];
  cta: string;
  href: string;
};

const MODES: Record<BookingMode, BookingModeConfig> = {
  "in-person": {
    label: "In-Person",
    rows: [
      { icon: MapPin, title: "NY / NJ / CT locations", subtitle: "We'll collect from your address" },
      { icon: Clock, title: "Most pairs ready in 72 hours" },
      { icon: Tag, title: "Pricing from $45", subtitle: "Final pricing based on condition and service" },
    ],
    cta: "View pricing & book now",
    href: "/booking?method=pickup",
  },
  "mail-in": {
    label: "Mail-In",
    rows: [
      { icon: Package, title: "Ships anywhere in the US", subtitle: "We email a prepaid shipping label" },
      { icon: Clock, title: "5-10 business days round trip", subtitle: "Includes transit time both ways" },
      { icon: Tag, title: "Pricing from $55", subtitle: "Includes return shipping, condition-dependent" },
    ],
    cta: "Request a mail-in label",
    href: "/booking?method=mail-in",
  },
};

export function BookingPanel() {
  const [mode, setMode] = useState<BookingMode>("in-person");
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
