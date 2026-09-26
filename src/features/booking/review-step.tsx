"use client";

import Link from "next/link";
import { ArrowRight, ImagePlus, Mail, MapPin, Package, Phone, Truck, User, type LucideIcon } from "lucide-react";
import { formatDate, type PickupSelection } from "./pickup-date-picker";
import type { ContactInfo, PairDetails, PickupAddress, ScheduleMethod, Step } from "./booking-types";

export function ReviewStep({
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
  contact,
  onEdit,
}: {
  isBundle: boolean;
  name: string;
  price: string;
  priceNote: string | undefined;
  Icon: LucideIcon;
  pairDetails: PairDetails;
  scheduleMethod: ScheduleMethod;
  pickupAddress: PickupAddress;
  pickupSelection: PickupSelection | null;
  mailInDate: PickupSelection | null;
  contact: ContactInfo;
  onEdit: (step: Step) => void;
}) {
  const scheduleText =
    scheduleMethod === "pickup"
      ? pickupSelection
        ? `${formatDate(pickupSelection.date)} · ${pickupSelection.time}`
        : "Not scheduled yet"
      : mailInDate
        ? formatDate(mailInDate.date)
        : "No preferred date selected";

  return (
    <>
      <div className="booking-page-section-head">
        <p className="booking-page-step-eyebrow">STEP 5 OF 5</p>
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
            Photos:{" "}
            <strong>
              {pairDetails.photos.length > 0
                ? `${pairDetails.photos.length} photo${pairDetails.photos.length === 1 ? "" : "s"}`
                : "No photos"}
            </strong>
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
          <button type="button" className="booking-page-edit-link" onClick={() => onEdit("contact")}>
            Edit
          </button>
        </div>
        <div className="booking-page-details-row">
          <User size={16} aria-hidden="true" />
          <span>{contact.name || "—"}</span>
        </div>
        <div className="booking-page-details-row">
          <Mail size={16} aria-hidden="true" />
          <span>{contact.email || "—"}</span>
        </div>
        <div className="booking-page-details-row">
          <Phone size={16} aria-hidden="true" />
          <span>{contact.phone || "—"}</span>
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
