"use client";

import Link from "next/link";
import { ArrowRight, CircleCheck, Info, Mail, Package, Truck, Wallet } from "lucide-react";
import { Money } from "@/shared/money/money";
import type { SubmitOrderResponse } from "./submit-booking";

// Shown in place of the steps once POST /api/v1/orders succeeds. Everything
// here comes from the server's response (its own estimate and Deposit, not
// the browser's), and the same details go out in the confirmation email.
// Rendered in-flow so there's no public order-lookup page to protect.
export function ConfirmationStep({ result, email }: { result: SubmitOrderResponse; email: string }) {
  const { order, paymentInstructions } = result;
  const estimate = Money.fromCents(order.estimateCents).format();
  const deposit = Money.fromCents(order.depositCents).format();
  const zelle = paymentInstructions.zelle;
  const pairs = order.pairCount === 1 ? "your pair" : `your ${order.pairCount} pairs`;

  return (
    <>
      <div className="booking-page-section-head">
        <p className="booking-page-step-eyebrow">BOOKING RECEIVED</p>
        <h2 className="booking-page-confirmation-title">
          <CircleCheck size={26} aria-hidden="true" />
          You&rsquo;re booked in.
        </h2>
        <p>
          Your reference is <strong>{order.reference}</strong>. It&rsquo;s saved to your account for {email}, and
          we&rsquo;ve emailed you the details.
        </p>
      </div>

      <div className="booking-page-review-card">
        <div className="booking-page-review-head">
          <span>DEPOSIT</span>
        </div>
        {order.bundleName && (
          <div className="booking-page-details-row">
            <span>
              Bundle: <strong>{order.bundleName}</strong> for {order.pairCount} pairs
            </span>
          </div>
        )}
        <div className="booking-page-details-row">
          <span>
            Estimated total: <strong>{order.estimateIsMinimum ? `from ${estimate}` : estimate}</strong>
          </span>
        </div>
        <div className="booking-page-details-row">
          <span>
            Deposit due now (50%): <strong>{deposit}</strong>
          </span>
        </div>
      </div>

      <div className="booking-page-review-card">
        <div className="booking-page-review-head">
          <span>HOW TO PAY</span>
        </div>
        {zelle ? (
          <>
            <div className="booking-page-details-row">
              <Wallet size={16} aria-hidden="true" />
              <span>
                Send <strong>{deposit}</strong> by Zelle to <strong>{zelle.recipient}</strong> ({zelle.name}).
              </span>
            </div>
            <div className="booking-page-details-row">
              <span>
                Put <strong>{order.reference}</strong> in the memo so we can match your payment.
              </span>
            </div>
          </>
        ) : (
          <div className="booking-page-details-row">
            <Mail size={16} aria-hidden="true" />
            <span>We&rsquo;ll email you how to pay the {deposit} deposit.</span>
          </div>
        )}
      </div>

      <div className="booking-page-review-card">
        <div className="booking-page-review-head">
          <span>WHAT HAPPENS NEXT</span>
        </div>
        <div className="booking-page-details-row">
          {order.fulfillmentMethod === "PICKUP" ? (
            <>
              <Truck size={16} aria-hidden="true" />
              <span>We&rsquo;ll collect {pairs} from your address at the time you picked.</span>
            </>
          ) : (
            <>
              <Package size={16} aria-hidden="true" />
              <span>We&rsquo;ll email you where to ship {pairs}.</span>
            </>
          )}
        </div>
      </div>

      <div className="booking-page-info-box">
        <Info size={16} aria-hidden="true" />
        <span>
          <strong>No surprises.</strong> We&rsquo;ll inspect your sneakers and confirm final pricing before any work
          begins.
        </span>
      </div>

      <Link className="landing-btn-primary booking-page-continue-btn" href="/">
        Back to home
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </>
  );
}
