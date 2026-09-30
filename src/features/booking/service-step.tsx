"use client";

import { useState } from "react";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { catalogService, formatPrice, formatServicePrice, serviceNotes } from "@/features/orders/service-catalog";
import { BOOKING_BUNDLES, BOOKING_SERVICES } from "./services-data";
import { SERVICES } from "@/features/landing/services";
import { ServiceRow } from "./service-row";

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
  const [attempted, setAttempted] = useState(false);
  const canContinue = isBundle || selectedServiceIds.length > 0;
  const showWarning = attempted && !canContinue;

  return (
    <>
      <div className="booking-page-section-head">
        <h2>{isBundle ? "Choose a bundle." : "Choose your service(s)."}</h2>
        <p>
          {isBundle
            ? "All bundles include 3 pairs, Premium Clean, and Suede fee waived."
            : "Pick one cleaning tier, then add any restoration or custom work you need — those stack freely."}{" "}
          Optional add-ons, like Lace Replacement, come next with your pair{isBundle ? "s'" : "'s"} details.
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
                price={formatPrice(bundle.priceCents, false)}
                isActive={bundle.id === selectedBundleId}
                onClick={() => onSelectBundle(bundle.id)}
              />
            ))
          : SERVICES.flatMap((category) => {
              const services = BOOKING_SERVICES.filter((service) => service.category === category.id);
              if (services.length === 0) return [];
              // Cleaning is single-select (you'd never book both Standard
              // and Premium on the same pair); every other category stacks
              // freely, so it renders as a checkbox. Add-ons are picked per
              // pair on the Details step (PairForm), not here.
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
                    price={formatServicePrice(catalogService(service.id))}
                    priceNote={serviceNotes(catalogService(service.id)).join(" · ") || undefined}
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
        onClick={() => {
          if (!canContinue) {
            setAttempted(true);
            return;
          }
          onContinue();
        }}
        aria-describedby={showWarning ? "service-step-warning" : undefined}
      >
        Continue
        <ArrowRight size={14} aria-hidden="true" />
      </button>
      {/* Always in the page, so screen readers announce the warning when it appears. */}
      <p className="booking-page-form-warning" id="service-step-warning" role="status" aria-live="polite">
        {showWarning && (
          <>
            <TriangleAlert size={14} aria-hidden="true" />
            Select at least one service to continue.
          </>
        )}
      </p>
    </>
  );
}
