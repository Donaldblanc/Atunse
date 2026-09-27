import { describe, expect, it } from "vitest";
import { acknowledgesAll, BOOKING_ACKNOWLEDGEMENTS } from "./booking-terms";

describe("booking acknowledgements", () => {
  it("lists the four published acknowledgements, in order, with unique ids", () => {
    expect(BOOKING_ACKNOWLEDGEMENTS.map((ack) => ack.text)).toEqual([
      "Final pricing is determined after inspection.",
      "Severe wear, damage, or specialty materials may incur additional charges.",
      "Results may vary. Re-yellowing can occur over time due to oxidation.",
      "Services improve appearance and feel but do not guarantee structural or performance restoration.",
    ]);
    expect(new Set(BOOKING_ACKNOWLEDGEMENTS.map((ack) => ack.id)).size).toBe(BOOKING_ACKNOWLEDGEMENTS.length);
  });

  it("is satisfied only when every acknowledgement was ticked, in any order", () => {
    const all = BOOKING_ACKNOWLEDGEMENTS.map((ack) => ack.id);
    expect(acknowledgesAll([...all].reverse())).toBe(true);
    expect(acknowledgesAll(all.slice(1))).toBe(false);
    expect(acknowledgesAll([])).toBe(false);
  });
});
