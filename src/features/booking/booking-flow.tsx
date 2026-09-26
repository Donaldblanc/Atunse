"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Info, Shield, Star, Truck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { PickupSelection } from "./pickup-date-picker";
import { BOOKING_BUNDLES, BOOKING_SERVICES } from "./services-data";
import {
  EMPTY_ADDRESS,
  EMPTY_CONTACT,
  EMPTY_PAIR,
  type ContactInfo,
  type FlowType,
  type PairDetails,
  type PickupAddress,
  type ScheduleMethod,
  type Step,
} from "./booking-types";
import { ServiceStep } from "./service-step";
import { DetailsStep } from "./details-step";
import { ScheduleStep } from "./schedule-step";
import { ContactStep } from "./contact-step";
import { ReviewStep } from "./review-step";

const STEPS: { key: Step; label: string }[] = [
  { key: "service", label: "Service" },
  { key: "details", label: "Details" },
  { key: "schedule", label: "Schedule" },
  { key: "contact", label: "Your Info" },
  { key: "review", label: "Review" },
];

// Step-indicator subtext for every step but "service", whose subtext is the
// currently selected service/bundle name (computed at render, not static).
// "details" pluralizes in the bundle flow, matching DetailsStep's heading.
const STEP_SUBTEXT: Record<Exclude<Step, "service">, (isBundle: boolean) => string> = {
  details: (isBundle) => `Tell us about your pair${isBundle ? "s" : ""}`,
  schedule: () => "Pickup or drop off",
  contact: () => "Contact details",
  review: () => "Confirm booking",
};

const RUSH_FEE = 20;
const SUEDE_FEE = 10;

// Only Standard/Premium Clean carry a flat +$10 Suede fee (their price is
// a plain "$NN", unlike the range-priced restoration services) — and it's
// only real when the customer actually picked Suede as the pair's
// material, not just a disclaimer note that never changed the price.
function computePricing(basePrice: string, baseNote: string | undefined, material: string, rush: boolean) {
  const isFlatPriced = /^\$\d+$/.test(basePrice);
  const hasSuedeFee = isFlatPriced && Boolean(baseNote?.includes("Suede"));
  if (!isFlatPriced) return { price: basePrice, priceNote: baseNote };

  const suedeApplies = hasSuedeFee && material === "Suede";
  const total = parseInt(basePrice.slice(1), 10) + (suedeApplies ? SUEDE_FEE : 0) + (rush ? RUSH_FEE : 0);
  const notes = [
    hasSuedeFee ? (suedeApplies ? `Includes +$${SUEDE_FEE} Suede fee` : baseNote) : baseNote,
    rush ? `+$${RUSH_FEE} rush` : null,
  ].filter((n): n is string => Boolean(n));
  return { price: `$${total}`, priceNote: notes.length > 0 ? notes.join(" · ") : undefined };
}

// Four real client-side steps, with two parallel flows: booking a single
// pair's service, or a 3-pair bundle (each pair gets its own detail tab).
// There's no real order-submission flow yet (docs/TODO.md) — "Confirm
// Booking" is presentational, matching every other not-yet-real CTA on
// the marketing site. Contact info (name/email/phone) isn't collected in
// this flow — shown as a static placeholder in the review step, matching
// scratch/landing-mock.html's "new flow" reference.
export function BookingFlow() {
  const searchParams = useSearchParams();
  const requestedServiceId = searchParams.get("service");
  const requestedService = BOOKING_SERVICES.find((service) => service.id === requestedServiceId);
  const requestedMethod = searchParams.get("method");
  const [flow, setFlow] = useState<FlowType>(requestedService ? "single" : "bundle");
  const [step, setStep] = useState<Step>("service");
  const [selectedServiceId, setSelectedServiceId] = useState(() => requestedService?.id ?? BOOKING_SERVICES[0]!.id);
  const [selectedBundleId, setSelectedBundleId] = useState(BOOKING_BUNDLES[0]!.id);
  const [activePair, setActivePair] = useState(0);
  const [singlePair, setSinglePair] = useState<PairDetails>(EMPTY_PAIR);
  const [pairs, setPairs] = useState<PairDetails[]>([EMPTY_PAIR, EMPTY_PAIR, EMPTY_PAIR]);
  const [scheduleMethod, setScheduleMethod] = useState<ScheduleMethod>(requestedMethod === "mail-in" ? "mail-in" : "pickup");
  const [pickupAddress, setPickupAddress] = useState<PickupAddress>(EMPTY_ADDRESS);
  const [pickupSelection, setPickupSelection] = useState<PickupSelection | null>(null);
  const [mailInDate, setMailInDate] = useState<PickupSelection | null>(null);
  const [contact, setContact] = useState<ContactInfo>(EMPTY_CONTACT);
  const [rush, setRush] = useState(false);

  const selectedService = BOOKING_SERVICES.find((s) => s.id === selectedServiceId) ?? BOOKING_SERVICES[0]!;
  const selectedBundle = BOOKING_BUNDLES.find((b) => b.id === selectedBundleId) ?? BOOKING_BUNDLES[0]!;
  const isBundle = flow === "bundle";
  const SelectedIcon = isBundle ? selectedBundle.icon : selectedService.icon;
  const selectedName = isBundle ? selectedBundle.name : selectedService.name;
  const { price: selectedPrice, priceNote: selectedPriceNote } = isBundle
    ? { price: selectedBundle.price, priceNote: undefined }
    : computePricing(selectedService.price, selectedService.priceNote, singlePair.material, rush);
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  function goBack() {
    setStep(STEPS[Math.max(0, stepIndex - 1)]!.key);
  }

  function changePair(index: number, details: PairDetails) {
    setPairs((prev) => prev.map((pair, i) => (i === index ? details : pair)));
  }

  return (
    <div className="booking-page-layout">
      <div className="booking-page-main">
        {step !== "service" && (
          <button type="button" className="booking-page-back-link" onClick={goBack}>
            <ArrowLeft size={14} aria-hidden="true" />
            <span className="booking-page-back-text">Back</span>
          </button>
        )}

        {step === "service" && (
          <div className="booking-page-flow-switch">
            <button type="button" data-active={!isBundle} onClick={() => setFlow("single")}>
              Single Pair
            </button>
            <button type="button" data-active={isBundle} onClick={() => setFlow("bundle")}>
              3-Pair Bundle
            </button>
          </div>
        )}

        <div className="booking-page-steps">
          {STEPS.map((s, index) => {
            const isDone = index < stepIndex;
            const isActive = index === stepIndex;
            const subtext = s.key === "service" ? selectedName : STEP_SUBTEXT[s.key](isBundle);
            return (
              <div key={s.key} className="booking-page-step-group">
                {index > 0 && <div className="booking-page-step-rule" />}
                <div className="booking-page-step" data-active={isActive} data-done={isDone}>
                  <span className="booking-page-step-num" aria-hidden="true">
                    {isDone ? <Check size={14} /> : index + 1}
                  </span>
                  <span className="booking-page-step-text">
                    <strong>{s.label}</strong>
                    <span>{subtext}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {step === "service" && (
          <ServiceStep
            isBundle={isBundle}
            selectedServiceId={selectedServiceId}
            onSelectService={setSelectedServiceId}
            selectedBundleId={selectedBundleId}
            onSelectBundle={setSelectedBundleId}
            onContinue={() => setStep("details")}
          />
        )}

        {step === "details" && (
          <DetailsStep
            isBundle={isBundle}
            activePair={activePair}
            onSelectPair={setActivePair}
            singlePair={singlePair}
            onChangeSinglePair={setSinglePair}
            pairs={pairs}
            onChangePair={changePair}
            onContinue={() => setStep("schedule")}
          />
        )}

        {step === "schedule" && (
          <ScheduleStep
            method={scheduleMethod}
            onSelectMethod={setScheduleMethod}
            pickupAddress={pickupAddress}
            onChangePickupAddress={setPickupAddress}
            pickupSelection={pickupSelection}
            onConfirmPickup={setPickupSelection}
            mailInDate={mailInDate}
            onChangeMailInDate={setMailInDate}
            onContinue={() => setStep("contact")}
          />
        )}

        {step === "contact" && (
          <ContactStep
            contact={contact}
            onChangeContact={setContact}
            rush={rush}
            onChangeRush={setRush}
            onContinue={() => setStep("review")}
          />
        )}

        {step === "review" && (
          <ReviewStep
            isBundle={isBundle}
            name={selectedName}
            price={selectedPrice}
            priceNote={selectedPriceNote}
            Icon={SelectedIcon}
            pairDetails={isBundle ? pairs[0]! : singlePair}
            scheduleMethod={scheduleMethod}
            pickupAddress={pickupAddress}
            pickupSelection={pickupSelection}
            mailInDate={mailInDate}
            contact={contact}
            onEdit={setStep}
          />
        )}
      </div>

      <aside className="booking-page-summary">
        <div className="booking-page-summary-head">
          <h2>{isBundle ? "Bundle summary" : "Order summary"}</h2>
        </div>
        {step === "service" && (
          <p className="booking-page-summary-lede">Review your selection. You&rsquo;ll confirm details and schedule next.</p>
        )}

        <div className="booking-page-summary-line">
          <span className="booking-page-service-icon" aria-hidden="true">
            <SelectedIcon size={18} />
          </span>
          <span className="booking-page-summary-line-body">
            <strong>{selectedName}</strong>
          </span>
          <span className="booking-page-summary-line-price">{selectedPrice}</span>
        </div>
        {selectedPriceNote && <span className="booking-page-summary-price-note">{selectedPriceNote}</span>}

        <div className="booking-page-summary-rule" />

        <div className="booking-page-summary-total">
          <span>Estimated total</span>
          <strong>{selectedPrice.includes("+") ? selectedPrice : `${selectedPrice}+`}</strong>
        </div>
        <p className="booking-page-summary-caption">Final pricing may vary based on condition.</p>

        <div className="booking-page-summary-note">
          <Info size={16} aria-hidden="true" />
          <span>
            <strong>No surprises.</strong>
            We&rsquo;ll inspect your sneakers and confirm final pricing before any work begins.
          </span>
        </div>

        <div className="booking-page-summary-feature">
          <Truck size={18} aria-hidden="true" />
          <span>
            <strong>Pickup or drop off</strong>
            Convenient options at scheduling.
          </span>
        </div>
        <div className="booking-page-summary-feature">
          <Shield size={18} aria-hidden="true" />
          <span>
            <strong>Expert care</strong>
            Handled with precision and care.
          </span>
        </div>
        <div className="booking-page-summary-feature">
          <Star size={18} aria-hidden="true" />
          <span>
            <strong>Updates along the way</strong>
            We&rsquo;ll keep you in the loop.
          </span>
        </div>

        <div className="booking-page-summary-rule" />
        <p className="booking-page-summary-contact">
          Questions? We&rsquo;re here to help.
          <br />
          <Link href="/coming-soon" className="landing-link-arrow">
            Contact us
            <ArrowRight size={12} aria-hidden="true" />
          </Link>
        </p>
      </aside>
    </div>
  );
}
