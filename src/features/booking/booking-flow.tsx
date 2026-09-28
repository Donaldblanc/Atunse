"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Info, Shield, Star, Truck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import type { PickupSelection } from "./pickup-date-picker";
import { BOOKING_BUNDLES, BOOKING_SERVICES, pricedLineForBundle } from "./services-data";
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
  type TermsSelection,
} from "./booking-types";
import { ServiceStep } from "./service-step";
import { DetailsStep } from "./details-step";
import { ScheduleStep } from "./schedule-step";
import { ContactStep } from "./contact-step";
import { ReviewStep } from "./review-step";
import { ConfirmationStep } from "./confirmation-step";
import { addOnLines, computeMultiServicePricing, pricedLineForService } from "./pricing";
import { formatPrice } from "@/features/orders/service-catalog";
import { CustomerSignIn } from "./customer-sign-in";
import { SubmissionConflict } from "./submission-conflict";
import { BookingSubmitError, submitBooking, type SubmitOrderResponse, type UploadedPhotoKeys } from "./submit-booking";

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
  schedule: () => "Local Drop-Off or mail in",
  contact: () => "Contact details",
  review: () => "Confirm booking",
};

// Five client-side steps, with two parallel flows: booking a single pair's
// additive service selection, or a 3-pair bundle (each pair gets its own
// detail tab). "Confirm Booking" uploads each pair's photos and submits a
// real Order (submit-booking.ts): one Item for a single pair, three for a
// Bundle. Then it shows the confirmation.
export function BookingFlow() {
  const searchParams = useSearchParams();
  const requestedServiceId = searchParams.get("service");
  const requestedService = BOOKING_SERVICES.find((service) => service.id === requestedServiceId);
  const requestedMethod = searchParams.get("method");
  const [flow, setFlow] = useState<FlowType>(requestedService ? "single" : "bundle");
  const [step, setStep] = useState<Step>("service");
  // Cleaning is single-select (Standard vs Premium — never both on one
  // pair); restoration/custom-work services stack, so they're tracked
  // separately and combine freely with each other and with the chosen
  // cleaning tier. Add-ons live on each pair (PairDetails.addOnIds).
  const [selectedCleaningId, setSelectedCleaningId] = useState<string | null>(() =>
    requestedService?.category === "cleaning" ? requestedService.id : null,
  );
  const [selectedStackableIds, setSelectedStackableIds] = useState<string[]>(() =>
    requestedService && requestedService.category !== "cleaning" ? [requestedService.id] : [],
  );
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
  // One key per booking, minted on the first Confirm: a retried Confirm
  // sends the same key and gets the same Order back, never a duplicate.
  const submissionKey = useRef<string | null>(null);
  // Photos already in storage for this booking, reused by retries (#78).
  const uploadedPhotoKeys = useRef<UploadedPhotoKeys>(new WeakMap());
  const [confirmation, setConfirmation] = useState<SubmitOrderResponse | null>(null);
  // Set when the server says the booking's email already has an Account:
  // the flow shows the customer login screen, then resubmits (ADR-0014).
  const [signInEmail, setSignInEmail] = useState<string | null>(null);
  // Set when this booking's submission key already created an Order with
  // other details (#76): the customer keeps that booking or books anew.
  const [conflict, setConflict] = useState<{ message: string; existing: SubmitOrderResponse } | null>(null);
  const termsRef = useRef<TermsSelection>({ policyAccepted: false, acknowledgedTerms: [], termsVersion: "" });

  const selectedServiceIds = [...(selectedCleaningId ? [selectedCleaningId] : []), ...selectedStackableIds];
  const selectedServices = BOOKING_SERVICES.filter((s) => selectedServiceIds.includes(s.id));
  const selectedBundle = BOOKING_BUNDLES.find((b) => b.id === selectedBundleId) ?? BOOKING_BUNDLES[0]!;
  const isBundle = flow === "bundle";
  const SelectedIcon = isBundle ? selectedBundle.icon : (selectedServices[0]?.icon ?? BOOKING_SERVICES[0]!.icon);
  const selectedAddOns = addOnLines((isBundle ? pairs : [singlePair]).map((pair) => pair.addOnIds));
  const { name: selectedName, price: selectedPrice, priceNote: selectedPriceNote } = isBundle
    ? computeMultiServicePricing([pricedLineForBundle(selectedBundle)], "", rush, selectedAddOns)
    : computeMultiServicePricing(selectedServices.map((s) => pricedLineForService(s.id)), singlePair.material, rush, selectedAddOns);
  const stepIndex = confirmation ? STEPS.length : STEPS.findIndex((s) => s.key === step);

  function goBack() {
    // Leaving Review drops any "sign in to finish" screen: the booking will
    // be resubmitted from Review, and the email may change on the way.
    setSignInEmail(null);
    setConflict(null);
    setStep(STEPS[Math.max(0, stepIndex - 1)]!.key);
  }

  function toggleService(id: string) {
    const service = BOOKING_SERVICES.find((s) => s.id === id);
    if (!service) return;
    if (service.category === "cleaning") {
      setSelectedCleaningId((prev) => (prev === id ? null : id));
    } else {
      setSelectedStackableIds((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]));
    }
  }

  async function confirmBooking(terms: TermsSelection) {
    termsRef.current = terms;
    submissionKey.current ??= crypto.randomUUID();
    let result: SubmitOrderResponse;
    try {
      result = await submitBooking({
        submissionKey: submissionKey.current,
        ...terms,
        bundleId: isBundle ? selectedBundle.id : null,
        serviceIds: isBundle ? [] : selectedServiceIds,
        pairs: isBundle ? pairs : [singlePair],
        scheduleMethod,
        address: pickupAddress,
        pickupSelection,
        mailInDate,
        contact,
        rush,
      }, uploadedPhotoKeys.current);
    } catch (err) {
      if (err instanceof BookingSubmitError && err.code === "SIGN_IN_REQUIRED") {
        setSignInEmail(contact.email.trim());
        window.scrollTo({ top: 0 });
        return;
      }
      if (err instanceof BookingSubmitError && err.code === "SUBMISSION_CONFLICT" && err.existing) {
        setConflict({ message: err.message, existing: err.existing });
        window.scrollTo({ top: 0 });
        return;
      }
      throw err;
    }
    setSignInEmail(null);
    setConflict(null);
    setConfirmation(result);
    window.scrollTo({ top: 0 });
  }

  function changePair(index: number, details: PairDetails) {
    setPairs((prev) => prev.map((pair, i) => (i === index ? details : pair)));
  }

  return (
    <div className="booking-page-layout">
      <div className="booking-page-main">
        {step !== "service" && !confirmation && (
          <button type="button" className="booking-page-back-link" onClick={goBack}>
            <ArrowLeft size={14} aria-hidden="true" />
            <span className="booking-page-back-text">Back</span>
          </button>
        )}

        {step === "service" && !confirmation && (
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

        {step === "service" && !confirmation && (
          <ServiceStep
            isBundle={isBundle}
            selectedServiceIds={selectedServiceIds}
            onToggleService={toggleService}
            selectedBundleId={selectedBundleId}
            onSelectBundle={setSelectedBundleId}
            onContinue={() => setStep("details")}
          />
        )}

        {step === "details" && !confirmation && (
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

        {step === "schedule" && !confirmation && (
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

        {step === "contact" && !confirmation && (
          <ContactStep
            contact={contact}
            onChangeContact={(next) => {
              setSignInEmail(null);
              setConflict(null);
              setContact(next);
            }}
            rush={rush}
            onChangeRush={setRush}
            onContinue={() => setStep("review")}
          />
        )}

        {step === "review" && !confirmation && signInEmail && (
          <CustomerSignIn
            email={signInEmail}
            onSignedIn={() => confirmBooking(termsRef.current)}
            onUseDifferentEmail={() => {
              setSignInEmail(null);
              setStep("contact");
            }}
          />
        )}

        {step === "review" && !confirmation && conflict && (
          <SubmissionConflict
            message={conflict.message}
            existing={conflict.existing}
            onViewExisting={() => {
              setConfirmation(conflict.existing);
              setConflict(null);
              window.scrollTo({ top: 0 });
            }}
            onBookAsNew={async () => {
              // A separate booking: a new submission key, and fresh photo
              // uploads, since the remembered ones belong to the first Order.
              submissionKey.current = null;
              uploadedPhotoKeys.current = new WeakMap();
              await confirmBooking(termsRef.current);
            }}
          />
        )}

        {step === "review" && !confirmation && !signInEmail && !conflict && (
          <ReviewStep
            isBundle={isBundle}
            name={selectedName}
            price={selectedPrice}
            priceNote={selectedPriceNote}
            Icon={SelectedIcon}
            pairs={isBundle ? pairs : [singlePair]}
            scheduleMethod={scheduleMethod}
            pickupAddress={pickupAddress}
            pickupSelection={pickupSelection}
            mailInDate={mailInDate}
            contact={contact}
            onEdit={setStep}
            onEditPair={(index) => {
              setActivePair(index);
              setStep("details");
            }}
            onConfirm={confirmBooking}
          />
        )}

        {confirmation && <ConfirmationStep result={confirmation} email={contact.email} />}
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
        {selectedAddOns.map((addOn) => (
          <div className="booking-page-summary-line booking-page-summary-addon" key={addOn.key}>
            <span className="booking-page-summary-line-body">
              <span>{addOn.name}</span>
            </span>
            <span className="booking-page-summary-line-price">+{formatPrice(addOn.baseCents, addOn.isMinimum)}</span>
          </div>
        ))}

        <div className="booking-page-summary-rule" />

        <div className="booking-page-summary-total">
          <span>Estimated total</span>
          {/* "+" only when the estimate really is a minimum, as the server says (#81). */}
          <strong>{selectedPrice}</strong>
        </div>
        <p className="booking-page-summary-caption">Final pricing may vary based on condition.</p>

        <div className="booking-page-summary-note">
          <Info size={16} aria-hidden="true" />
          <span>
            <strong>Pricing confirmed first.</strong>
            We&rsquo;ll inspect your sneakers and confirm final pricing with you before any work begins.
          </span>
        </div>

        <div className="booking-page-summary-feature">
          <Truck size={18} aria-hidden="true" />
          <span>
            <strong>Local Drop-Off or mail in</strong>
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
          <Link href="/contact" className="landing-link-arrow">
            Contact us
            <ArrowRight size={12} aria-hidden="true" />
          </Link>
        </p>
      </aside>
    </div>
  );
}
