import { describe, expect, it } from "vitest";
import { adminVisitSlots, PICKUP_TIME_SLOTS } from "./pickup-window";
import { returnVisitState } from "./return-visit";
import { resolveVisitSlot, VisitSlotError } from "./visit-slot";
import type { Order } from "./domain";

const NOW = new Date("2026-10-01T15:00:00Z"); // Oct 1, 11:00 AM in New York

describe("adminVisitSlots", () => {
  it("offers none for a past day and every slot for a future day", () => {
    expect(adminVisitSlots("2026-09-30", NOW)).toEqual([]);
    expect(adminVisitSlots("2026-10-02", NOW)).toEqual([...PICKUP_TIME_SLOTS]);
  });

  it("offers today's slots from now on, with no customer lead time", () => {
    const today = adminVisitSlots("2026-10-01", NOW);
    expect(today[0]).toBe("11:00 AM – 11:30 AM");
    expect(today.at(-1)).toBe("9:30 PM – 10:00 PM");
  });
});

describe("resolveVisitSlot", () => {
  it("returns the shop-time instants for a valid slot", () => {
    const { startsAt, endsAt } = resolveVisitSlot("2026-10-03", "4:30 PM – 5:00 PM", NOW);
    expect(startsAt.toISOString()).toBe("2026-10-03T20:30:00.000Z");
    expect(endsAt.toISOString()).toBe("2026-10-03T21:00:00.000Z");
  });

  it("refuses malformed dates, off-grid slots and slots that have started", () => {
    expect(() => resolveVisitSlot("10/03/2026", "4:30 PM – 5:00 PM", NOW)).toThrow(VisitSlotError);
    expect(() => resolveVisitSlot("2026-10-03", "4:45 PM – 5:15 PM", NOW)).toThrow(VisitSlotError);
    expect(() => resolveVisitSlot("2026-10-01", "8:00 AM – 8:30 AM", NOW)).toThrow(VisitSlotError);
  });
});

describe("returnVisitState", () => {
  const address = { line1: "1 A St", line2: null, city: "New York", state: "NY", zip: "10001" };
  const local = { method: "PICKUP", address, date: "2026-10-03", slot: "4:30 PM – 5:00 PM" } as const;
  const order = (over: Partial<Pick<Order, "fulfillment" | "items" | "appointments">> = {}) =>
    ({ fulfillment: local, items: [{ status: "READY_FOR_PICKUP_SHIPPING" }], appointments: [], ...over }) as unknown as Pick<Order, "fulfillment" | "items" | "appointments">;
  const appt = (status: "SCHEDULED" | "COMPLETED" | "CANCELLED") => ({ id: "a", kind: "RETURN", status, startsAt: NOW, endsAt: NOW, notes: null }) as const;

  it("is bookable for Local Drop-Off with a ready pair and no live Return", () => {
    expect(returnVisitState(order())).toEqual({ kind: "bookable" });
    expect(returnVisitState(order({ appointments: [appt("CANCELLED")] }))).toEqual({ kind: "bookable" });
  });

  it("is booked once a SCHEDULED or COMPLETED Return exists", () => {
    expect(returnVisitState(order({ appointments: [appt("SCHEDULED")] })).kind).toBe("booked");
    expect(returnVisitState(order({ appointments: [appt("COMPLETED")] })).kind).toBe("booked");
  });

  it("is unavailable for Mail-In and when nothing is ready", () => {
    expect(returnVisitState(order({ fulfillment: { method: "MAIL_IN", address, preferredDate: null } }))).toEqual({ kind: "unavailable", reason: "mail-in" });
    expect(returnVisitState(order({ items: [{ status: "IN_PROGRESS" }] as never }))).toEqual({ kind: "unavailable", reason: "nothing-ready" });
  });
});
