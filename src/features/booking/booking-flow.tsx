"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  ImagePlus,
  Info,
  Mail,
  MapPin,
  Package,
  Phone,
  Shield,
  Star,
  Truck,
  User,
} from "lucide-react";
import { useState } from "react";
import { BOOKING_SERVICES } from "./services-data";

type Step = "service" | "details";
type ShippingMethod = "mail-in" | "pickup";

const STEPS: { key: Step; label: string }[] = [
  { key: "service", label: "Service" },
  { key: "details", label: "Details" },
];

// Two real client-side steps: pick a service, then tell us about you. A
// third "Checkout" step is shown in the indicator for orientation, but
// there's no real payment/order-submission flow yet (docs/TODO.md), so
// "Continue to Checkout" routes to /coming-soon like every other
// not-yet-real CTA on the marketing site.
export function BookingFlow() {
  const [step, setStep] = useState<Step>("service");
  const [selectedId, setSelectedId] = useState(BOOKING_SERVICES[0]!.id);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("mail-in");
  const selected = BOOKING_SERVICES.find((service) => service.id === selectedId) ?? BOOKING_SERVICES[0]!;
  const SelectedIcon = selected.icon;
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="booking-page-layout">
      <div className="booking-page-main">
        {step === "details" && (
          <button type="button" className="booking-page-back-link" onClick={() => setStep("service")}>
            <ArrowLeft size={14} aria-hidden="true" />
            Back
          </button>
        )}

        <div className="booking-page-steps">
          {STEPS.map((s, index) => {
            const isDone = index < stepIndex;
            const isActive = index === stepIndex;
            return (
              <div key={s.key} className="booking-page-step-group">
                {index > 0 && <div className="booking-page-step-rule" />}
                <div className="booking-page-step" data-active={isActive} data-done={isDone}>
                  <span className="booking-page-step-num" aria-hidden="true">
                    {isDone ? <Check size={14} /> : index + 1}
                  </span>
                  <span className="booking-page-step-text">
                    <strong>{s.label}</strong>
                    <span>{s.key === "service" ? selected.name : "Your information"}</span>
                  </span>
                </div>
              </div>
            );
          })}
          <div className="booking-page-step-rule" />
          <div className="booking-page-step">
            <span className="booking-page-step-num" aria-hidden="true">
              3
            </span>
            <span className="booking-page-step-text">
              <strong>Checkout</strong>
              <span>Review &amp; pay</span>
            </span>
          </div>
        </div>

        {step === "service" ? (
          <>
            <div className="booking-page-section-head">
              <h2>What does your pair need?</h2>
              <p>Select a service below to get started.</p>
            </div>

            <div className="booking-page-service-list">
              {BOOKING_SERVICES.map((service) => {
                const Icon = service.icon;
                const isActive = service.id === selectedId;
                return (
                  <button
                    type="button"
                    key={service.id}
                    className="booking-page-service-row"
                    data-active={isActive}
                    onClick={() => setSelectedId(service.id)}
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

            <div className="booking-page-section-head booking-page-section-head-tight">
              <h2>Tell us about your sneakers</h2>
            </div>

            <div className="booking-page-form-grid">
              <label className="booking-page-field">
                <span>Brand / Model</span>
                <input type="text" placeholder="e.g. Nike Air Force 1" />
              </label>
              <label className="booking-page-field">
                <span>Material (optional)</span>
                <select defaultValue="">
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
                <textarea placeholder="Tell us anything we should know..." />
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
                <span className="booking-page-field-caption">Add a few photos to help us assess your pair.</span>
              </div>
            </div>

            <button type="button" className="landing-btn-primary booking-page-continue-btn" onClick={() => setStep("details")}>
              Continue to details
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <div className="booking-page-section-head">
              <p className="booking-page-step-eyebrow">STEP 2 OF 3</p>
              <h2>Tell us about you.</h2>
              <p>Your contact details and booking preferences. We&rsquo;ll create an account for you automatically.</p>
            </div>

            <div className="booking-page-form-grid">
              <label className="booking-page-field booking-page-field-icon">
                <span>Full name</span>
                <span className="booking-page-input-wrap">
                  <User size={16} aria-hidden="true" />
                  <input type="text" placeholder="e.g. John Doe" />
                </span>
              </label>
            </div>
            <div className="booking-page-form-grid">
              <label className="booking-page-field booking-page-field-icon">
                <span>Email</span>
                <span className="booking-page-input-wrap">
                  <Mail size={16} aria-hidden="true" />
                  <input type="email" placeholder="e.g. john@example.com" />
                </span>
                <span className="booking-page-field-caption">We&rsquo;ll use this email for booking updates and account access.</span>
              </label>
            </div>
            <div className="booking-page-form-grid">
              <label className="booking-page-field booking-page-field-icon">
                <span>Phone</span>
                <span className="booking-page-input-wrap">
                  <Phone size={16} aria-hidden="true" />
                  <input type="tel" placeholder="+1 (123) 456-7890" />
                </span>
              </label>
            </div>

            <div className="booking-page-section-head booking-page-section-head-tight">
              <p className="booking-page-step-eyebrow">SHIPPING / PICKUP</p>
            </div>
            <div className="booking-page-shipping-grid">
              <button
                type="button"
                className="booking-page-shipping-card"
                data-active={shippingMethod === "mail-in"}
                onClick={() => setShippingMethod("mail-in")}
              >
                <Package size={20} aria-hidden="true" />
                <span>
                  <strong>Mail in</strong>
                  <span>We&rsquo;ll send you a prepaid label after checkout</span>
                </span>
              </button>
              <button
                type="button"
                className="booking-page-shipping-card"
                data-active={shippingMethod === "pickup"}
                onClick={() => setShippingMethod("pickup")}
              >
                <MapPin size={20} aria-hidden="true" />
                <span>
                  <strong>Pickup</strong>
                  <span>We&rsquo;ll collect your address for pickup</span>
                </span>
              </button>
            </div>

            <div className="booking-page-form-grid">
              <label className="booking-page-field">
                <span>Address</span>
                <input type="text" placeholder="e.g. 123 Main St" />
              </label>
              <label className="booking-page-field">
                <span>Apt, suite, etc. (optional)</span>
                <input type="text" placeholder="e.g. Apt 4B" />
              </label>
            </div>
            <div className="booking-page-form-grid booking-page-form-grid-thirds">
              <label className="booking-page-field">
                <span>City</span>
                <input type="text" placeholder="e.g. New York" />
              </label>
              <label className="booking-page-field">
                <span>State / Province</span>
                <select defaultValue="">
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
                <input type="text" placeholder="e.g. 10001" />
              </label>
            </div>

            <div className="booking-page-form-grid">
              <label className="booking-page-field booking-page-field-icon">
                <span>Preferred date (optional)</span>
                <span className="booking-page-input-wrap">
                  <Calendar size={16} aria-hidden="true" />
                  <input type="date" />
                </span>
              </label>
            </div>

            <Link className="landing-btn-primary booking-page-continue-btn" href="/coming-soon">
              Continue to Checkout
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <p className="booking-page-terms">
              By continuing, you agree to our{" "}
              <Link href="/coming-soon">Terms &amp; Conditions</Link> and <Link href="/coming-soon">Privacy Policy</Link>.
            </p>
          </>
        )}
      </div>

      <aside className="booking-page-summary">
        <div className="booking-page-summary-head">
          <h2>Order summary</h2>
          {step === "details" && (
            <button type="button" className="booking-page-summary-edit" onClick={() => setStep("service")}>
              Edit
            </button>
          )}
        </div>
        {step === "service" && (
          <p className="booking-page-summary-lede">Review your selection. You&rsquo;ll confirm details and schedule next.</p>
        )}

        <div className="booking-page-summary-line">
          <span className="booking-page-service-icon" aria-hidden="true">
            <SelectedIcon size={18} />
          </span>
          <span className="booking-page-summary-line-body">
            <strong>{selected.name}</strong>
          </span>
          <span className="booking-page-summary-line-price">{selected.price}</span>
        </div>
        {selected.priceNote && <span className="booking-page-summary-price-note">{selected.priceNote}</span>}

        <div className="booking-page-summary-rule" />

        <div className="booking-page-summary-total">
          <span>Estimated total</span>
          <strong>{selected.price.includes("+") ? selected.price : `${selected.price}+`}</strong>
        </div>
        <p className="booking-page-summary-caption">Final pricing may vary based on condition.</p>

        {step === "service" && (
          <div className="booking-page-summary-note">
            <Info size={16} aria-hidden="true" />
            <span>
              <strong>No surprises.</strong>
              We&rsquo;ll inspect your sneakers and confirm final pricing before any work begins.
            </span>
          </div>
        )}

        <div className="booking-page-summary-feature">
          <Truck size={18} aria-hidden="true" />
          <span>
            <strong>{step === "service" ? "Ship or drop off" : "Mail in or pickup"}</strong>
            {step === "service" ? "Convenient options at checkout." : "Choose the option that works best for you."}
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
            <strong>{step === "service" ? "Updates along the way" : "Real-time updates"}</strong>
            {step === "service" ? "We’ll keep you in the loop." : "We’ll keep you in the loop via email and text."}
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
