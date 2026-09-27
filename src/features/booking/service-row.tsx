"use client";

import { Check, type LucideIcon } from "lucide-react";

// One selectable row in the booking flow: a Service or Bundle on the
// Service step, or an Add-on in a pair's form on the Details step.
export function ServiceRow({
  Icon,
  name,
  subtitle,
  price,
  priceNote,
  badge,
  isActive,
  shape = "radio",
  onClick,
}: {
  Icon: LucideIcon;
  name: string;
  subtitle: string;
  price: string;
  priceNote?: string;
  badge?: string;
  isActive: boolean;
  shape?: "radio" | "checkbox";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="booking-page-service-row"
      data-active={isActive}
      onClick={onClick}
      role={shape === "checkbox" ? "checkbox" : undefined}
      aria-checked={shape === "checkbox" ? isActive : undefined}
      aria-pressed={shape === "radio" ? isActive : undefined}
    >
      <span
        className={`booking-page-service-check${shape === "checkbox" ? " booking-page-service-check--checkbox" : ""}`}
        aria-hidden="true"
      >
        <Check size={12} />
      </span>
      <span className="booking-page-service-icon" aria-hidden="true">
        <Icon size={20} />
      </span>
      <span className="booking-page-service-body">
        <strong>
          {name}
          {badge && <span className="booking-page-badge">{badge}</span>}
        </strong>
        <span>{subtitle}</span>
      </span>
      <span className="booking-page-service-price">
        <strong>{price}</strong>
        {priceNote && <span>{priceNote}</span>}
      </span>
    </button>
  );
}
