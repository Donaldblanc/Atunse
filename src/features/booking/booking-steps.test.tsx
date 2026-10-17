import { renderToStaticMarkup } from "react-dom/server";
import { Sparkles } from "lucide-react";
import { describe, expect, it } from "vitest";
import { BOOKING_ACKNOWLEDGMENTS } from "@/features/orders/booking-terms";
import { PRIVACY_POLICY, TERMS_AGREEMENT } from "@/shared/legal-documents";
import { EMPTY_ADDRESS, EMPTY_CONTACT, EMPTY_PAIR } from "./booking-types";
import { CancelNotice } from "./cancel-notice";
import { ConfirmationStep } from "./confirmation-step";
import { ContactStep } from "./contact-step";
import { ReviewStep } from "./review-step";
import type { SubmitOrderResponse } from "./submit-booking";

const CANCEL = "Need to cancel your booking or close your account?";

function review(cancelEmail: string | null) {
  return renderToStaticMarkup(
    <ReviewStep
      isBundle={false}
      bundlePairServices=""
      name="Single Pair"
      price="$40"
      priceNote={undefined}
      Icon={Sparkles}
      pairs={[EMPTY_PAIR]}
      scheduleMethod="pickup"
      pickupAddress={EMPTY_ADDRESS}
      pickupSelection={null}
      mailInDate={null}
      contact={EMPTY_CONTACT}
      onEdit={() => {}}
      onEditPair={() => {}}
      onConfirm={async () => {}}
      cancelEmail={cancelEmail}
    />,
  );
}

describe("CancelNotice", () => {
  it("links the shop inbox from the server", () => {
    const html = renderToStaticMarkup(<CancelNotice email="shop@example.com" />);
    expect(html).toContain(`${CANCEL} Email us at <a href="mailto:shop@example.com">shop@example.com</a>.`);
  });

  it("falls back to the contact form when no inbox is configured", () => {
    const html = renderToStaticMarkup(<CancelNotice email={null} />);
    expect(html).toContain(CANCEL);
    expect(html).toContain('href="/contact"');
    expect(html).not.toContain("mailto:");
  });
});

describe("ReviewStep agreements", () => {
  const html = review("shop@example.com");

  it("shows every risk acknowledgment plus the Terms Agreement, none pre-checked", () => {
    const checkboxes = html.match(/<input[^>]*type="checkbox"[^>]*>/g) ?? [];
    expect(checkboxes).toHaveLength(BOOKING_ACKNOWLEDGMENTS.length + 1);
    expect(checkboxes.every((box) => !box.includes("checked"))).toBe(true);
    expect(checkboxes.every((box) => box.includes("required"))).toBe(true);
  });

  it("gives every checkbox an accessible name by wrapping it in a label", () => {
    const labels = html.match(/<label class="booking-page-policy">.*?<\/label>/g) ?? [];
    expect(labels).toHaveLength(BOOKING_ACKNOWLEDGMENTS.length + 1);
    for (const label of labels) expect(label).toMatch(/<input[^>]*type="checkbox"[^>]*>.*<\/span>/);
    for (const ack of BOOKING_ACKNOWLEDGMENTS) expect(html).toContain(ack.lead);
  });

  it("keeps Confirm Booking disabled until everything is ticked", () => {
    const button = html.match(/<button[^>]*>Confirm Booking/)?.[0] ?? "";
    expect(button).toContain("disabled");
    expect(html).toContain("Tick each acknowledgment and the Terms Agreement");
  });

  it("opens the Terms Agreement PDF in a new tab", () => {
    expect(html).toContain(`href="${TERMS_AGREEMENT.href}" target="_blank" rel="noopener noreferrer"`);
    expect(TERMS_AGREEMENT.href).toMatch(/\.pdf$/);
    expect(html).toContain(`href="${PRIVACY_POLICY.href}"`);
  });

  it("tells the customer how to cancel, below the agreement checkboxes and above Confirm Booking", () => {
    expect(html).toContain(`${CANCEL} Email us at <a href="mailto:shop@example.com">`);
    expect(html.indexOf(CANCEL)).toBeGreaterThan(html.indexOf("Terms Agreement"));
    expect(html.indexOf(CANCEL)).toBeLessThan(html.indexOf("Confirm Booking"));
  });
});

describe("ConfirmationStep", () => {
  const result: SubmitOrderResponse = {
    order: {
      id: "ord_1",
      reference: "ATU-1001",
      fulfillmentMethod: "PICKUP",
      estimateCents: 8500,
      estimateIsMinimum: false,
      depositCents: 4250,
      pairCount: 1,
      bundleName: null,
    },
    paymentInstructions: { zelle: { recipient: "pay@example.com", name: "Shop" } },
  };

  it("tells the customer how to cancel", () => {
    const html = renderToStaticMarkup(<ConfirmationStep result={result} email="j@example.com" cancelEmail="shop@example.com" />);
    expect(html).toContain(`${CANCEL} Email us at <a href="mailto:shop@example.com">shop@example.com</a>.`);
  });

  it("points at the contact form when there is no inbox", () => {
    const html = renderToStaticMarkup(<ConfirmationStep result={result} email="j@example.com" cancelEmail={null} />);
    expect(html).toContain('href="/contact"');
  });
});

describe("ContactStep birth month and year", () => {
  const html = renderToStaticMarkup(
    <ContactStep contact={EMPTY_CONTACT} onChangeContact={() => {}} rush={false} onChangeRush={() => {}} onContinue={() => {}} />,
  );

  it("asks for both as required selects, month by name and years back 100", () => {
    expect(html).toContain("Birth month");
    expect(html).toContain("Birth year");
    expect(html).toContain(">January</option>");
    expect(html).toContain(">December</option>");
    const years = [...html.matchAll(/<option value="(\d{4})">/g)].map((m) => Number(m[1]));
    expect(years).toHaveLength(101);
    expect(years[0]! - years.at(-1)!).toBe(100);
    expect(html.match(/<select[^>]*required/g)).toHaveLength(2);
  });
});
