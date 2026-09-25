"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Calendar, Check, ImagePlus, Info, Mail, MapPin, Package, Phone, Shield, Star, Truck, User } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { PickupDatePicker, type PickupSelection } from "./pickup-date-picker";
import { BOOKING_BUNDLES, BOOKING_SERVICES } from "./services-data";

type FlowType = "single" | "bundle";
type Step = "service" | "details" | "schedule" | "review";
type ScheduleMethod = "pickup" | "mail-in";
type PairDetails = { brand: string; material: string; notes: string };
type PickupAddress = { address: string; apt: string; city: string; state: string; zip: string };

const EMPTY_PAIR: PairDetails = { brand: "", material: "", notes: "" };
const EMPTY_ADDRESS: PickupAddress = { address: "", apt: "", city: "", state: "", zip: "" };

const STEPS: { key: Step; label: string }[] = [
  { key: "service", label: "Service" },
  { key: "details", label: "Details" },
  { key: "schedule", label: "Schedule" },
  { key: "review", label: "Review" },
];

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
  const [flow, setFlow] = useState<FlowType>("single");
  const [step, setStep] = useState<Step>("service");
  const [selectedServiceId, setSelectedServiceId] = useState(
    () => BOOKING_SERVICES.find((service) => service.id === requestedServiceId)?.id ?? BOOKING_SERVICES[0]!.id,
  );
  const [selectedBundleId, setSelectedBundleId] = useState(BOOKING_BUNDLES[0]!.id);
  const [activePair, setActivePair] = useState(0);
  const [singlePair, setSinglePair] = useState<PairDetails>(EMPTY_PAIR);
  const [pairs, setPairs] = useState<PairDetails[]>([EMPTY_PAIR, EMPTY_PAIR, EMPTY_PAIR]);
  const [scheduleMethod, setScheduleMethod] = useState<ScheduleMethod>("pickup");
  const [pickupAddress, setPickupAddress] = useState<PickupAddress>(EMPTY_ADDRESS);
  const [pickupSelection, setPickupSelection] = useState<PickupSelection | null>(null);
  const [mailInDate, setMailInDate] = useState("");

  const selectedService = BOOKING_SERVICES.find((s) => s.id === selectedServiceId) ?? BOOKING_SERVICES[0]!;
  const selectedBundle = BOOKING_BUNDLES.find((b) => b.id === selectedBundleId) ?? BOOKING_BUNDLES[0]!;
  const isBundle = flow === "bundle";
  const SelectedIcon = isBundle ? selectedBundle.icon : selectedService.icon;
  const selectedName = isBundle ? selectedBundle.name : selectedService.name;
  const selectedPrice = isBundle ? selectedBundle.price : selectedService.price;
  const selectedPriceNote = isBundle ? undefined : selectedService.priceNote;
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
            const subtext =
              s.key === "service"
                ? selectedName
                : s.key === "details"
                  ? "Tell us about your pair"
                  : s.key === "schedule"
                    ? "Pickup or drop off"
                    : "Confirm booking";
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

function ServiceStep({
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

function PairForm({
  pairLabel,
  brandPlaceholder,
  details,
  onChange,
}: {
  pairLabel?: string;
  brandPlaceholder: string;
  details: PairDetails;
  onChange: (details: PairDetails) => void;
}) {
  return (
    <>
      {pairLabel && (
        <div className="booking-page-section-head booking-page-section-head-tight">
          <h3>{pairLabel}</h3>
        </div>
      )}
      <div className="booking-page-form-grid">
        <label className="booking-page-field">
          <span>Brand / Model</span>
          <input
            type="text"
            placeholder={brandPlaceholder}
            value={details.brand}
            onChange={(e) => onChange({ ...details, brand: e.target.value })}
          />
        </label>
        <label className="booking-page-field">
          <span>Material (optional)</span>
          <select value={details.material} onChange={(e) => onChange({ ...details, material: e.target.value })}>
            <option value="" disabled>
              Select material
            </option>
            <option>Leather</option>
            <option>Suede</option>
            <option>Canvas</option>
            <option>Knit / Mesh</option>
          </select>
        </label>
      </div>
      <div className="booking-page-form-grid">
        <label className="booking-page-field">
          <span>Additional notes (optional)</span>
          <textarea
            maxLength={500}
            value={details.notes}
            onChange={(e) => onChange({ ...details, notes: e.target.value })}
            placeholder="Tell us anything we should know..."
          />
          <span className="booking-page-char-count">{details.notes.length}/500</span>
        </label>
        <div className="booking-page-field">
          <span>Upload photos (optional)</span>
          <div className="booking-page-dropzone">
            <ImagePlus size={22} aria-hidden="true" />
            <span>
              Drag &amp; drop photos here
              <br />
              or click to upload
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function DetailsStep({
  isBundle,
  activePair,
  onSelectPair,
  singlePair,
  onChangeSinglePair,
  pairs,
  onChangePair,
  onContinue,
}: {
  isBundle: boolean;
  activePair: number;
  onSelectPair: (index: number) => void;
  singlePair: PairDetails;
  onChangeSinglePair: (details: PairDetails) => void;
  pairs: PairDetails[];
  onChangePair: (index: number, details: PairDetails) => void;
  onContinue: () => void;
}) {
  return (
    <>
      <div className="booking-page-section-head">
        <p className="booking-page-step-eyebrow">STEP 2 OF 4</p>
        <h2>Tell us about your pair{isBundle ? "s" : ""}.</h2>
        <p>Help us give you the best care possible.</p>
      </div>

      {isBundle ? (
        <>
          <div className="booking-page-pair-tabs">
            {[0, 1, 2].map((index) => (
              <button type="button" key={index} data-active={activePair === index} onClick={() => onSelectPair(index)}>
                Pair {index + 1}
              </button>
            ))}
          </div>
          <PairForm
            pairLabel={`Pair details (${activePair + 1} of 3)`}
            brandPlaceholder="e.g. Nike Air Jordan 1"
            details={pairs[activePair]!}
            onChange={(details) => onChangePair(activePair, details)}
          />
        </>
      ) : (
        <PairForm brandPlaceholder="e.g. Nike Air Force 1" details={singlePair} onChange={onChangeSinglePair} />
      )}

      <button type="button" className="landing-btn-primary booking-page-continue-btn" onClick={onContinue}>
        Continue to schedule
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </>
  );
}

function ScheduleStep({
  method,
  onSelectMethod,
  pickupAddress,
  onChangePickupAddress,
  pickupSelection,
  onConfirmPickup,
  mailInDate,
  onChangeMailInDate,
  onContinue,
}: {
  method: ScheduleMethod;
  onSelectMethod: (method: ScheduleMethod) => void;
  pickupAddress: PickupAddress;
  onChangePickupAddress: (address: PickupAddress) => void;
  pickupSelection: PickupSelection | null;
  onConfirmPickup: (selection: PickupSelection) => void;
  mailInDate: string;
  onChangeMailInDate: (date: string) => void;
  onContinue: () => void;
}) {
  return (
    <>
      <div className="booking-page-section-head">
        <p className="booking-page-step-eyebrow">STEP 3 OF 4</p>
        <h2>Pickup or mail in?</h2>
        <p>Choose how you&rsquo;d like to get your sneakers to us.</p>
      </div>

      <div className="booking-page-shipping-grid">
        <button type="button" className="booking-page-shipping-card" data-active={method === "pickup"} onClick={() => onSelectMethod("pickup")}>
          <Truck size={20} aria-hidden="true" />
          <span>
            <strong>Pickup</strong>
            <span>We&rsquo;ll collect your sneakers from your address.</span>
          </span>
        </button>
        <button type="button" className="booking-page-shipping-card" data-active={method === "mail-in"} onClick={() => onSelectMethod("mail-in")}>
          <Package size={20} aria-hidden="true" />
          <span>
            <strong>Mail in</strong>
            <span>We&rsquo;ll send you a prepaid label after checkout.</span>
          </span>
        </button>
      </div>

      <div className="booking-page-section-head booking-page-section-head-tight">
        <p className="booking-page-step-eyebrow" style={{ margin: 0 }}>
          {method === "pickup" ? "PICKUP ADDRESS" : "SHIPPING ADDRESS"}
        </p>
      </div>
      <div className="booking-page-form-grid">
        <label className="booking-page-field">
          <span>Address</span>
          <input
            type="text"
            placeholder="e.g. 123 Main St"
            value={pickupAddress.address}
            onChange={(e) => onChangePickupAddress({ ...pickupAddress, address: e.target.value })}
          />
        </label>
        <label className="booking-page-field">
          <span>Apt, suite, etc. (optional)</span>
          <input
            type="text"
            placeholder="e.g. Apt 4B"
            value={pickupAddress.apt}
            onChange={(e) => onChangePickupAddress({ ...pickupAddress, apt: e.target.value })}
          />
        </label>
      </div>
      <div className="booking-page-form-grid booking-page-form-grid-thirds">
        <label className="booking-page-field">
          <span>City</span>
          <input
            type="text"
            placeholder="e.g. New York"
            value={pickupAddress.city}
            onChange={(e) => onChangePickupAddress({ ...pickupAddress, city: e.target.value })}
          />
        </label>
        <label className="booking-page-field">
          <span>State / Province</span>
          <select
            value={pickupAddress.state}
            onChange={(e) => onChangePickupAddress({ ...pickupAddress, state: e.target.value })}
          >
            <option value="" disabled>
              Select
            </option>
            <option>NY</option>
            <option>NJ</option>
            <option>CT</option>
          </select>
        </label>
        <label className="booking-page-field">
          <span>Zip / Postal code</span>
          <input
            type="text"
            placeholder="e.g. 10001"
            value={pickupAddress.zip}
            onChange={(e) => onChangePickupAddress({ ...pickupAddress, zip: e.target.value })}
          />
        </label>
      </div>

      {method === "pickup" ? (
        <>
          <div className="booking-page-section-head booking-page-section-head-tight">
            <p className="booking-page-step-eyebrow" style={{ margin: 0 }}>
              PICKUP DATE
            </p>
          </div>
          <PickupDatePicker selection={pickupSelection} onConfirm={onConfirmPickup} />

          <div className="booking-page-info-box">
            <Info size={16} aria-hidden="true" />
            <span>
              Available pickup times are between
              <br />
              <strong>4:30 PM &ndash; 10:00 PM.</strong>
            </span>
          </div>
        </>
      ) : (
        <div className="booking-page-form-grid">
          <label className="booking-page-field booking-page-field-icon">
            <span>Preferred date (optional)</span>
            <span className="booking-page-input-wrap">
              <Calendar size={16} aria-hidden="true" />
              <input type="date" value={mailInDate} onChange={(e) => onChangeMailInDate(e.target.value)} />
            </span>
          </label>
        </div>
      )}

      <button type="button" className="landing-btn-primary booking-page-continue-btn" onClick={onContinue}>
        Continue to review
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </>
  );
}

function ReviewStep({
  isBundle,
  name,
  price,
  priceNote,
  Icon,
  pairDetails,
  scheduleMethod,
  pickupAddress,
  pickupSelection,
  mailInDate,
  onEdit,
}: {
  isBundle: boolean;
  name: string;
  price: string;
  priceNote: string | undefined;
  Icon: typeof Truck;
  pairDetails: PairDetails;
  scheduleMethod: ScheduleMethod;
  pickupAddress: PickupAddress;
  pickupSelection: PickupSelection | null;
  mailInDate: string;
  onEdit: (step: Step) => void;
}) {
  const scheduleText =
    scheduleMethod === "pickup"
      ? pickupSelection
        ? `${pickupSelection.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} · ${pickupSelection.time}`
        : "Not scheduled yet"
      : mailInDate
        ? new Date(`${mailInDate}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
        : "No preferred date selected";

  return (
    <>
      <div className="booking-page-section-head">
        <p className="booking-page-step-eyebrow">STEP 4 OF 4</p>
        <h2>Review &amp; confirm.</h2>
        <p>Here&rsquo;s a summary of your order. You can go back to make changes.</p>
      </div>

      <div className="booking-page-review-card">
        <div className="booking-page-review-head">
          <span>{isBundle ? "BUNDLE SUMMARY" : "ORDER SUMMARY"}</span>
          <button type="button" className="booking-page-edit-link" onClick={() => onEdit("service")}>
            Edit
          </button>
        </div>
        <div className="booking-page-review-line">
          <span className="booking-page-review-thumb" aria-hidden="true">
            <Icon size={20} />
          </span>
          <span className="booking-page-review-line-body">
            <strong>{name}</strong>
            {priceNote && <span>{priceNote}</span>}
          </span>
          <span className="booking-page-review-line-price">{price}</span>
        </div>
        <div className="booking-page-details-row" style={{ marginTop: 14 }}>
          <User size={16} aria-hidden="true" />
          <span>
            Brand / Model: <strong>{pairDetails.brand || "—"}</strong>
          </span>
        </div>
        <div className="booking-page-details-row">
          <span>
            Material: <strong>{pairDetails.material || "—"}</strong>
          </span>
        </div>
        <div className="booking-page-details-row">
          <ImagePlus size={16} aria-hidden="true" />
          <span>
            Photos: <strong>No photos</strong>
          </span>
        </div>
        <div className="booking-page-details-row">
          <span>
            Notes: <strong>{pairDetails.notes || "No notes"}</strong>
          </span>
        </div>
      </div>

      <div className="booking-page-review-card">
        <div className="booking-page-review-head">
          <span>SCHEDULE</span>
          <button type="button" className="booking-page-edit-link" onClick={() => onEdit("schedule")}>
            Edit
          </button>
        </div>
        <div className="booking-page-details-row">
          {scheduleMethod === "pickup" ? <Truck size={16} aria-hidden="true" /> : <Package size={16} aria-hidden="true" />}
          <span>
            <strong>{scheduleMethod === "pickup" ? "Pickup" : "Mail in"}</strong>, {scheduleText}
          </span>
        </div>
        <div className="booking-page-details-row">
          <MapPin size={16} aria-hidden="true" />
          <span>
            {pickupAddress.address || "No address entered yet"}
            {pickupAddress.apt && `, ${pickupAddress.apt}`}
            <br />
            {[pickupAddress.city, [pickupAddress.state, pickupAddress.zip].filter(Boolean).join(" ")]
              .filter(Boolean)
              .join(", ")}
          </span>
        </div>
      </div>

      <div className="booking-page-review-card">
        <div className="booking-page-review-head">
          <span>CONTACT</span>
          <button type="button" className="booking-page-edit-link" onClick={() => onEdit("schedule")}>
            Edit
          </button>
        </div>
        <div className="booking-page-details-row">
          <User size={16} aria-hidden="true" />
          <span>John Doe</span>
        </div>
        <div className="booking-page-details-row">
          <Mail size={16} aria-hidden="true" />
          <span>john@example.com</span>
        </div>
        <div className="booking-page-details-row">
          <Phone size={16} aria-hidden="true" />
          <span>(123) 456-7890</span>
        </div>
      </div>

      <Link className="landing-btn-primary booking-page-continue-btn" href="/coming-soon">
        Confirm Booking
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
      <p className="booking-page-terms">
        By continuing, you agree to our <Link href="/coming-soon">Terms &amp; Conditions</Link> and{" "}
        <Link href="/coming-soon">Privacy Policy</Link>.
      </p>
    </>
  );
}
