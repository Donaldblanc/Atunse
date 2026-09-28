import { describe, expect, it } from "vitest";
import { acknowledgesAll, BOOKING_ACKNOWLEDGMENTS, TERMS_AGREEMENT } from "./booking-terms";

describe("booking acknowledgments", () => {
  it("lists the four published risk acknowledgments, in order, with unique ids", () => {
    expect(BOOKING_ACKNOWLEDGMENTS.map((ack) => ack.lead)).toEqual([
      "Final pricing is determined after inspection.",
      "Restoration results may vary.",
      "Restoration involves inherent material risks.",
      "Restoration does not guarantee structural or performance restoration.",
    ]);
    expect(BOOKING_ACKNOWLEDGMENTS.every((ack) => ack.detail.startsWith("I understand that "))).toBe(true);
    expect(new Set(BOOKING_ACKNOWLEDGMENTS.map((ack) => ack.id)).size).toBe(BOOKING_ACKNOWLEDGMENTS.length);
  });

  it("is satisfied only when every acknowledgment was ticked, in any order", () => {
    const all = BOOKING_ACKNOWLEDGMENTS.map((ack) => ack.id);
    expect(acknowledgesAll([...all].reverse())).toBe(true);
    expect(acknowledgesAll(all.slice(1))).toBe(false);
    expect(acknowledgesAll([])).toBe(false);
  });

  it("links the agreement as a same-site PDF", () => {
    expect(TERMS_AGREEMENT.href).toMatch(/^\/legal\/[a-z-]+\.pdf$/);
  });
});
