"use client";

import { ArrowRight, Check, type LucideIcon } from "lucide-react";
import { BOOKING_BUNDLES, BOOKING_SERVICES } from "./services-data";
import { SERVICES } from "@/features/landing/services";

function ServiceRow({
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

export function ServiceStep({
  isBundle,
  selectedServiceIds,
  onToggleService,
  selectedBundleId,
  onSelectBundle,
  onContinue,
}: {
  isBundle: boolean;
  selectedServiceIds: string[];
  onToggleService: (id: string) => void;
  selectedBundleId: string;
  onSelectBundle: (id: string) => void;
  onContinue: () => void;
}) {
  const canContinue = isBundle || selectedServiceIds.length > 0;

  return (
    <>
      <div className="booking-page-section-head">
        <h2>{isBundle ? "Choose a bundle." : "Choose your service(s)."}</h2>
        <p>
          {isBundle
            ? "All bundles include 3 pairs, Premium Clean, and Suede fee waived."
            : "Pick one cleaning tier, then add any restoration or custom work you need — those stack freely."}
        </p>
      </div>

      <div className="booking-page-service-list">
        {isBundle
          ? BOOKING_BUNDLES.map((bundle) => (
              <ServiceRow
                key={bundle.id}
                Icon={bundle.icon}
                name={bundle.name}
                subtitle={bundle.perks.join(" · ")}
                price={bundle.price}
                isActive={bundle.id === selectedBundleId}
                onClick={() => onSelectBundle(bundle.id)}
              />
            ))
          : SERVICES.flatMap((category) => {
              const services = BOOKING_SERVICES.filter((service) => service.category === category.id);
              if (services.length === 0) return [];
              // Cleaning is single-select (you'd never book both Standard
              // and Premium on the same pair); every other category is an
              // additive add-on, so it renders as a checkbox.
              const shape = category.id === "cleaning" ? "radio" : "checkbox";
              return [
                <p className="booking-page-service-group-label" key={category.id}>
                  {category.title}
                </p>,
                ...services.map((service) => (
                  <ServiceRow
                    key={service.id}
                    Icon={service.icon}
                    name={service.name}
                    subtitle={service.description}
                    price={service.price}
                    priceNote={service.priceNote}
                    badge={service.badge}
                    shape={shape}
                    isActive={selectedServiceIds.includes(service.id)}
                    onClick={() => onToggleService(service.id)}
                  />
                )),
              ];
            })}
      </div>

      <button
        type="button"
        className="landing-btn-primary booking-page-continue-btn"
        onClick={onContinue}
        disabled={!canContinue}
        title={canContinue ? undefined : "Select at least one service to continue"}
      >
        Continue
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </>
  );
}
