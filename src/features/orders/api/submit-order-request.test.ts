import { describe, expect, it } from "vitest";
import { parseSubmitOrderRequest } from "./submit-order-request";

const body = {
  policyAccepted: true,
  contact: { name: "Jordan Smith", email: "customer@example.com", phone: "2125550142" },
  fulfillment: {
    method: "PICKUP",
    address: { line1: "123 Main St", city: "New York", state: "NY", zip: "10001" },
    date: "2026-10-03",
    slot: "4:30 PM – 5:00 PM",
  },
  rush: false,
  item: { brand: "Nike", material: "Leather", serviceIds: ["standard"], photoKeys: ["bookings/x/0.jpg"] },
};

const key = "3c1f0e2a-7d4b-4a8e-9f6c-1b2d3e4f5a6b";

describe("parseSubmitOrderRequest", () => {
  it("parses a pickup booking and normalizes missing optionals to null", () => {
    const result = parseSubmitOrderRequest(body, key);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.submissionKey).toBe(key);
    expect(result.value.item.notes).toBeNull();
    expect(result.value.fulfillment.address.line2).toBeNull();
  });

  it("parses a mail-in booking without a preferred date", () => {
    const result = parseSubmitOrderRequest(
      { ...body, fulfillment: { method: "MAIL_IN", address: body.fulfillment.address } },
      null,
    );
    expect(result.ok && result.value.fulfillment).toMatchObject({ method: "MAIL_IN", preferredDate: null });
  });

  it("rejects a fulfillment method that doesn't exist (there is no drop-off)", () => {
    const result = parseSubmitOrderRequest({ ...body, fulfillment: { ...body.fulfillment, method: "DROP_OFF" } }, null);
    expect(result.ok).toBe(false);
  });

  it("names the offending field", () => {
    const result = parseSubmitOrderRequest({ ...body, policyAccepted: "yes" }, null);
    expect(result).toEqual({ ok: false, error: expect.stringContaining("policyAccepted") });
  });

  it("ignores any client-sent price", () => {
    const result = parseSubmitOrderRequest({ ...body, estimateCents: 1, item: { ...body.item, priceCents: 1 } }, null);
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain("priceCents");
  });

  it("rejects a non-UUID Idempotency-Key", () => {
    expect(parseSubmitOrderRequest(body, "retry-please")).toEqual({ ok: false, error: expect.stringContaining("UUID") });
  });
});
