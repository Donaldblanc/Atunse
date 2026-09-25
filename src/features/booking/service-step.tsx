"use client";

import { ArrowRight, Check, type LucideIcon } from "lucide-react";
import { BOOKING_BUNDLES, BOOKING_SERVICES } from "./services-data";

function ServiceRow({
  Icon,
  name,
  subtitle,
  price,
  priceNote,
  badge,
  isActive,
  onClick,
}: {
  Icon: LucideIcon;
  name: string;
  subtitle: string;
  price: string;
  priceNote?: string;
  badge?: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="booking-page-service-row"
      data-active={isActive}
      onClick={onClick}
      aria-pressed={isActive}
    >
      <span className="booking-page-service-check" aria-hidden="true">
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
  selectedServiceId,
  onSelectService,
  selectedBundleId,
  onSelectBundle,
  onContinue,
}: {
  isBundle: boolean;
  selectedServiceId: string;
  onSelectService: (id: string) => void;
  selectedBundleId: string;
  onSelectBundle: (id: string) => void;
  onContinue: () => void;
}) {
  return (
    <>
      <div className="booking-page-section-head">
        <h2>{isBundle ? "Choose a bundle." : "Choose your service."}</h2>
        <p>{isBundle ? "All bundles include 3 pairs, Premium Clean, and Suede fee waived." : "Clean, restore, and bring your sneakers back to life."}</p>
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
          : BOOKING_SERVICES.map((service) => (
              <ServiceRow
                key={service.id}
                Icon={service.icon}
                name={service.name}
                subtitle={service.description}
                price={service.price}
                priceNote={service.priceNote}
                badge={service.badge}
                isActive={service.id === selectedServiceId}
                onClick={() => onSelectService(service.id)}
              />
            ))}
      </div>

      <button type="button" className="landing-btn-primary booking-page-continue-btn" onClick={onContinue}>
        Continue
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </>
  );
}
