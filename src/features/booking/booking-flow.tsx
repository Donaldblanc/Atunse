"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  Copy,
  ImagePlus,
  Info,
  Mail,
  MapPin,
  Package,
  Phone,
  Shield,
  ShieldCheck,
  Star,
  Truck,
  User,
} from "lucide-react";
import { useRef, useState } from "react";
import { BOOKING_SERVICES } from "./services-data";

type Step = "service" | "details" | "checkout";
type ShippingMethod = "mail-in" | "pickup";
type PaymentMethod = "cashapp" | "zelle";

type ContactDetails = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  apt: string;
  city: string;
  state: string;
  zip: string;
  date: string;
};

const EMPTY_DETAILS: ContactDetails = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  apt: "",
  city: "",
  state: "",
  zip: "",
  date: "",
};

const STEPS: { key: Step; label: string }[] = [
  { key: "service", label: "Service" },
  { key: "details", label: "Details" },
  { key: "checkout", label: "Checkout" },
];

const SHIPPING_COPY: Record<ShippingMethod, { name: string; desc: string; icon: typeof Package }> = {
  "mail-in": { name: "Mail in", desc: "We’ll send you a prepaid label after checkout.", icon: Package },
  pickup: { name: "Pickup", desc: "We’ll collect your address for pickup.", icon: MapPin },
};

// Three real client-side steps: pick a service, tell us about you, then
// review and pay. There's no real payment/order-submission flow yet
// (docs/TODO.md) — "Book Now" is presentational, matching every other
// not-yet-real CTA on the marketing site.
export function BookingFlow() {
  const [step, setStep] = useState<Step>("service");
  const [selectedId, setSelectedId] = useState(BOOKING_SERVICES[0]!.id);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("mail-in");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cashapp");
  const [details, setDetails] = useState<ContactDetails>(EMPTY_DETAILS);
  const selected = BOOKING_SERVICES.find((service) => service.id === selectedId) ?? BOOKING_SERVICES[0]!;
  const SelectedIcon = selected.icon;
  const FulfillmentIcon = SHIPPING_COPY[shippingMethod].icon;
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  const fullNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const aptRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef<HTMLSelectElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  function goToCheckout() {
    setDetails({
      fullName: fullNameRef.current?.value ?? "",
      email: emailRef.current?.value ?? "",
      phone: phoneRef.current?.value ?? "",
      address: addressRef.current?.value ?? "",
      apt: aptRef.current?.value ?? "",
      city: cityRef.current?.value ?? "",
      state: stateRef.current?.value ?? "",
      zip: zipRef.current?.value ?? "",
      date: dateRef.current?.value ?? "",
    });
    setStep("checkout");
  }

  const displayPrice = selected.price.startsWith("$") ? `${selected.price}.00` : selected.price;

  return (
    <div className="booking-page-layout">
      <div className="booking-page-main">
        {step !== "service" && (
          <button
            type="button"
            className="booking-page-back-link"
            onClick={() => setStep(step === "checkout" ? "details" : "service")}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span className="booking-page-back-text">Back</span>
          </button>
        )}

        <div className="booking-page-steps">
          {STEPS.map((s, index) => {
            const isDone = index < stepIndex;
            const isActive = index === stepIndex;
            const subtext = s.key === "service" ? selected.name : s.key === "details" ? "Your information" : "Review & pay";
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
        )}

        {step === "details" && (
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
                  <input ref={fullNameRef} type="text" placeholder="e.g. John Doe" defaultValue={details.fullName} />
                </span>
              </label>
            </div>
            <div className="booking-page-form-grid">
              <label className="booking-page-field booking-page-field-icon">
                <span>Email</span>
                <span className="booking-page-input-wrap">
                  <Mail size={16} aria-hidden="true" />
                  <input ref={emailRef} type="email" placeholder="e.g. john@example.com" defaultValue={details.email} />
                </span>
                <span className="booking-page-field-caption">We&rsquo;ll use this email for booking updates and account access.</span>
              </label>
            </div>
            <div className="booking-page-form-grid">
              <label className="booking-page-field booking-page-field-icon">
                <span>Phone</span>
                <span className="booking-page-input-wrap">
                  <Phone size={16} aria-hidden="true" />
                  <input ref={phoneRef} type="tel" placeholder="+1 (123) 456-7890" defaultValue={details.phone} />
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
                <input ref={addressRef} type="text" placeholder="e.g. 123 Main St" defaultValue={details.address} />
              </label>
              <label className="booking-page-field">
                <span>Apt, suite, etc. (optional)</span>
                <input ref={aptRef} type="text" placeholder="e.g. Apt 4B" defaultValue={details.apt} />
              </label>
            </div>
            <div className="booking-page-form-grid booking-page-form-grid-thirds">
              <label className="booking-page-field">
                <span>City</span>
                <input ref={cityRef} type="text" placeholder="e.g. New York" defaultValue={details.city} />
              </label>
              <label className="booking-page-field">
                <span>State / Province</span>
                <select ref={stateRef} defaultValue={details.state || ""}>
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
                <input ref={zipRef} type="text" placeholder="e.g. 10001" defaultValue={details.zip} />
              </label>
            </div>

            <div className="booking-page-form-grid">
              <label className="booking-page-field booking-page-field-icon">
                <span>Preferred date (optional)</span>
                <span className="booking-page-input-wrap">
                  <Calendar size={16} aria-hidden="true" />
                  <input ref={dateRef} type="date" defaultValue={details.date} />
                </span>
              </label>
            </div>

            <button type="button" className="landing-btn-primary booking-page-continue-btn" onClick={goToCheckout}>
              Continue to Checkout
              <ArrowRight size={14} aria-hidden="true" />
            </button>
            <p className="booking-page-terms">
              By continuing, you agree to our{" "}
              <Link href="/coming-soon">Terms &amp; Conditions</Link> and <Link href="/coming-soon">Privacy Policy</Link>.
            </p>
          </>
        )}

        {step === "checkout" && (
          <>
            <div className="booking-page-section-head">
              <p className="booking-page-step-eyebrow">STEP 3 OF 3</p>
              <h2>Review &amp; pay.</h2>
              <p>Double-check your order, then complete payment to confirm your restoration.</p>
            </div>

            <div className="booking-page-review-card">
              <div className="booking-page-review-head">
                <span>ORDER SUMMARY</span>
                <button type="button" className="booking-page-edit-link" onClick={() => setStep("service")}>
                  Edit
                </button>
              </div>
              <div className="booking-page-review-line">
                <span className="booking-page-review-thumb" aria-hidden="true">
                  <SelectedIcon size={20} />
                </span>
                <span className="booking-page-review-line-body">
                  <strong>{selected.name}</strong>
                  <span>1 pair &middot; Sneakers</span>
                </span>
                <span className="booking-page-review-line-price">{displayPrice}</span>
              </div>
              <div className="booking-page-summary-rule" />
              <div className="booking-page-summary-total">
                <span>Total</span>
                <strong>{displayPrice}</strong>
              </div>
            </div>

            <div className="booking-page-review-card">
              <div className="booking-page-review-head">
                <span>FULFILLMENT</span>
                <button type="button" className="booking-page-edit-link" onClick={() => setStep("details")}>
                  Edit
                </button>
              </div>
              <div className="booking-page-review-line">
                <span className="booking-page-review-thumb" aria-hidden="true">
                  <FulfillmentIcon size={20} />
                </span>
                <span className="booking-page-review-line-body">
                  <strong>{SHIPPING_COPY[shippingMethod].name}</strong>
                  <span>{SHIPPING_COPY[shippingMethod].desc}</span>
                </span>
              </div>
            </div>

            <div
              className="booking-page-section-head booking-page-section-head-tight"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
            >
              <p className="booking-page-step-eyebrow" style={{ margin: 0 }}>
                PAYMENT METHOD
              </p>
              <span className="booking-page-secure">
                <ShieldCheck size={14} aria-hidden="true" />
                Secure payment
              </span>
            </div>

            <div className="booking-page-payment-list">
              <div className="booking-page-payment-card" data-active={paymentMethod === "cashapp"}>
                <button type="button" className="booking-page-payment-head" onClick={() => setPaymentMethod("cashapp")}>
                  <span className="booking-page-payment-radio" aria-hidden="true" />
                  <span className="booking-page-payment-icon booking-page-payment-icon-cashapp" aria-hidden="true">
                    $
                  </span>
                  <span className="booking-page-payment-label">
                    <strong>Pay with Cash App</strong>
                    <span>Send payment securely with Cash App.</span>
                  </span>
                  <ChevronDown size={14} className="booking-page-payment-chevron" aria-hidden="true" />
                </button>
                {paymentMethod === "cashapp" && (
                  <div className="booking-page-payment-body">
                    <div className="booking-page-qr-grid">
                      <div className="booking-page-qr-box">
                        <div className="booking-page-qr-placeholder" aria-hidden="true">
                          <span className="booking-page-payment-icon booking-page-payment-icon-cashapp">$</span>
                        </div>
                        <strong>$Atunse</strong>
                        <button type="button" className="booking-page-tap-copy">
                          Tap to copy
                        </button>
                      </div>
                      <ol className="booking-page-qr-steps">
                        <li>
                          <span>1</span>
                          <div>
                            <strong>Open Cash App</strong>
                            <p>Scan the QR code or search for our Cashtag.</p>
                          </div>
                        </li>
                        <li>
                          <span>2</span>
                          <div>
                            <strong>Send exact amount</strong>
                            <p>
                              Send <strong>{displayPrice}</strong> to $Atunse
                            </p>
                          </div>
                        </li>
                        <li>
                          <span>3</span>
                          <div>
                            <strong>Tap &ldquo;Book Now&rdquo;</strong>
                            <p>After payment, tap below to confirm your booking.</p>
                          </div>
                        </li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>

              <div className="booking-page-payment-card" data-active={paymentMethod === "zelle"}>
                <button type="button" className="booking-page-payment-head" onClick={() => setPaymentMethod("zelle")}>
                  <span className="booking-page-payment-radio" aria-hidden="true" />
                  <span className="booking-page-payment-icon booking-page-payment-icon-zelle" aria-hidden="true">
                    Z
                  </span>
                  <span className="booking-page-payment-label">
                    <strong>Pay with Zelle</strong>
                    <span>Send payment securely with Zelle.</span>
                  </span>
                  <ChevronDown size={14} className="booking-page-payment-chevron" aria-hidden="true" />
                </button>
                {paymentMethod === "zelle" && (
                  <div className="booking-page-payment-body">
                    <div className="booking-page-zelle-box">
                      <p className="booking-page-zelle-heading">
                        Send <strong>{displayPrice}</strong> via Zelle
                      </p>
                      <div className="booking-page-zelle-grid">
                        <ol className="booking-page-qr-steps">
                          <li>
                            <span>1</span>
                            <div>
                              <strong>Open your banking app</strong>
                              <p>Go to Zelle&reg; and choose &ldquo;Send Money&rdquo;.</p>
                            </div>
                          </li>
                          <li>
                            <span>2</span>
                            <div>
                              <strong>Send exact amount</strong>
                              <p>
                                Send <strong>{displayPrice}</strong> to{" "}
                                <a href="mailto:payments@atunse.com">payments@atunse.com</a>
                              </p>
                            </div>
                          </li>
                          <li>
                            <span>3</span>
                            <div>
                              <strong>Add a note (optional)</strong>
                              <p>Use your order number as a reference.</p>
                            </div>
                          </li>
                        </ol>
                        <div className="booking-page-zelle-recipient">
                          <span className="booking-page-zelle-avatar" aria-hidden="true">
                            A
                          </span>
                          <strong>Atunse</strong>
                          <span>payments@atunse.com</span>
                          <button type="button" className="booking-page-copy-email">
                            <Copy size={14} aria-hidden="true" />
                            Copy email
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Link className="landing-btn-primary booking-page-continue-btn" href="/coming-soon">
              Book Now
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <p className="booking-page-terms">
              By continuing, you agree to our{" "}
              <Link href="/coming-soon">Terms &amp; Conditions</Link> and <Link href="/coming-soon">Privacy Policy</Link>.
            </p>
          </>
        )}
      </div>

      {step === "checkout" ? (
        <aside className="booking-page-summary">
          <div className="booking-page-review-head" style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", letterSpacing: "normal", textTransform: "none" }}>
              Your details
            </span>
            <button type="button" className="booking-page-edit-link" onClick={() => setStep("details")}>
              Edit
            </button>
          </div>
          <div className="booking-page-details-row">
            <User size={16} aria-hidden="true" />
            <span>{details.fullName || "Not provided"}</span>
          </div>
          <div className="booking-page-details-row">
            <Mail size={16} aria-hidden="true" />
            <span>{details.email || "Not provided"}</span>
          </div>
          <div className="booking-page-details-row">
            <Phone size={16} aria-hidden="true" />
            <span>{details.phone || "Not provided"}</span>
          </div>

          <div className="booking-page-summary-rule" />

          <div className="booking-page-review-head" style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", letterSpacing: "normal", textTransform: "none" }}>
              Shipping address
            </span>
            <button type="button" className="booking-page-edit-link" onClick={() => setStep("details")}>
              Edit
            </button>
          </div>
          <div className="booking-page-details-row">
            <MapPin size={16} aria-hidden="true" />
            <span>
              {details.address || "Not provided"}
              {details.apt && `, ${details.apt}`}
              <br />
              {[details.city, details.state, details.zip].filter(Boolean).join(", ")}
            </span>
          </div>

          <div className="booking-page-summary-rule" />

          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", marginBottom: 12 }}>Pickup date</div>
          <div className="booking-page-details-row">
            <Calendar size={16} aria-hidden="true" />
            <span>{details.date || "Not selected"}</span>
          </div>

          <div className="booking-page-next-box">
            <strong>What happens next?</strong>
            <div className="booking-page-next-item">
              <Mail size={16} aria-hidden="true" />
              <span>
                <strong>1. Complete payment</strong>
                Send payment via Cash App or Zelle to confirm your booking.
              </span>
            </div>
            <div className="booking-page-next-item">
              <Package size={16} aria-hidden="true" />
              <span>
                <strong>2. Send or drop off</strong>
                If you selected mail-in, we&rsquo;ll email you a prepaid label. If pickup, we&rsquo;ll collect your address on
                the next screen.
              </span>
            </div>
            <div className="booking-page-next-item">
              <Star size={16} aria-hidden="true" />
              <span>
                <strong>3. We restore it</strong>
                Our experts get to work, keeping you updated along the way.
              </span>
            </div>
            <div className="booking-page-next-item">
              <SelectedIcon size={16} aria-hidden="true" />
              <span>
                <strong>4. Get them back fresh</strong>
                Your sneakers are returned clean, restored, and ready for what&rsquo;s next.
              </span>
            </div>
          </div>

          <div className="booking-page-summary-rule" />
          <p className="booking-page-summary-contact">
            Need help?
            <br />
            Questions? We&rsquo;re here to help.
            <br />
            <Link href="/coming-soon" className="landing-link-arrow">
              Contact us
              <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </p>
        </aside>
      ) : (
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
      )}
    </div>
  );
}
