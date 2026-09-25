"use client";

import Link from "next/link";
import { MapPin, Clock, Tag, Package } from "lucide-react";
import { useState } from "react";
import { ArrowIcon } from "./arrow-icon";

type BookingMode = "in-person" | "mail-in";

export function BookingPanel() {
  const [mode, setMode] = useState<BookingMode>("in-person");

  return (
    <div className="landing-booking" id="process">
      <h2>Booking &amp; Pricing</h2>
      <div className="landing-booking-toggle">
        <button data-active={mode === "in-person"} onClick={() => setMode("in-person")}>
          In-Person
        </button>
        <button data-active={mode === "mail-in"} onClick={() => setMode("mail-in")}>
          Mail-In
        </button>
      </div>

      {mode === "in-person" ? (
        <>
          <div className="landing-booking-row">
            <span className="landing-booking-icon" aria-hidden="true">
              <MapPin size={16} />
            </span>
            <div>
              <strong>NY / NJ / CT locations</strong>
              <span>Drop off at a convenient location</span>
            </div>
          </div>
          <div className="landing-booking-row">
            <span className="landing-booking-icon" aria-hidden="true">
              <Clock size={16} />
            </span>
            <div>
              <strong>Most pairs ready in 72 hours</strong>
            </div>
          </div>
          <div className="landing-booking-row">
            <span className="landing-booking-icon" aria-hidden="true">
              <Tag size={16} />
            </span>
            <div>
              <strong>Pricing from $45</strong>
              <span>Final pricing based on condition and service</span>
            </div>
          </div>
          <Link className="landing-btn-primary" href="/booking">
            View pricing &amp; book now
            <ArrowIcon />
          </Link>
        </>
      ) : (
        <>
          <div className="landing-booking-row">
            <span className="landing-booking-icon" aria-hidden="true">
              <Package size={16} />
            </span>
            <div>
              <strong>Ships anywhere in the US</strong>
              <span>We email a prepaid shipping label</span>
            </div>
          </div>
          <div className="landing-booking-row">
            <span className="landing-booking-icon" aria-hidden="true">
              <Clock size={16} />
            </span>
            <div>
              <strong>5-10 business days round trip</strong>
              <span>Includes transit time both ways</span>
            </div>
          </div>
          <div className="landing-booking-row">
            <span className="landing-booking-icon" aria-hidden="true">
              <Tag size={16} />
            </span>
            <div>
              <strong>Pricing from $55</strong>
              <span>Includes return shipping, condition-dependent</span>
            </div>
          </div>
          <Link className="landing-btn-primary" href="/booking">
            Request a mail-in label
            <ArrowIcon />
          </Link>
        </>
      )}
    </div>
  );
}
