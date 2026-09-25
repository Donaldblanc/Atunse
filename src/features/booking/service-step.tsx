import { ArrowRight, Check } from "lucide-react";
import { BOOKING_BUNDLES, BOOKING_SERVICES } from "./services-data";

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

      {isBundle ? (
        <div className="booking-page-service-list">
          {BOOKING_BUNDLES.map((bundle) => {
            const Icon = bundle.icon;
            const isActive = bundle.id === selectedBundleId;
            return (
              <button
                type="button"
                key={bundle.id}
                className="booking-page-service-row"
                data-active={isActive}
                onClick={() => onSelectBundle(bundle.id)}
                aria-pressed={isActive}
              >
                <span className="booking-page-service-check" aria-hidden="true">
                  <Check size={12} />
                </span>
                <span className="booking-page-service-icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <span className="booking-page-service-body">
                  <strong>{bundle.name}</strong>
                  <span>{bundle.perks.join(" · ")}</span>
                </span>
                <span className="booking-page-service-price">
                  <strong>{bundle.price}</strong>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="booking-page-service-list">
          {BOOKING_SERVICES.map((service) => {
            const Icon = service.icon;
            const isActive = service.id === selectedServiceId;
            return (
              <button
                type="button"
                key={service.id}
                className="booking-page-service-row"
                data-active={isActive}
                onClick={() => onSelectService(service.id)}
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
                    {service.name}
                    {service.badge && <span className="booking-page-badge">{service.badge}</span>}
                  </strong>
                  <span>{service.description}</span>
                </span>
                <span className="booking-page-service-price">
                  <strong>{service.price}</strong>
                  {service.priceNote && <span>{service.priceNote}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <button type="button" className="landing-btn-primary booking-page-continue-btn" onClick={onContinue}>
        Continue
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </>
  );
}
