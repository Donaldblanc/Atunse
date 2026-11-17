import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_SETTINGS } from "./default-catalog";
import { adminVisitSlots, daySlots } from "./pickup-window";
import { returnVisitState } from "./return-visit";
import { resolveVisitSlot, VisitSlotError } from "./visit-slot";
import type { Order } from "./domain";

const HOURS = DEFAULT_SITE_SETTINGS.hours;
const NOW = new Date("2026-10-01T15:00:00Z"); // Oct 1, 11:00 AM in New York

describe("adminVisitSlots", () => {
  it("offers none for a past day and every slot for a future day", () => {
    expect(adminVisitSlots("2026-09-30", NOW, HOURS)).toEqual([]);
    expect(adminVisitSlots("2026-10-02", NOW, HOURS)).toEqual(daySlots("2026-10-02", HOURS));
  });

  it("offers today's slots from now on, with no customer lead time", () => {
    const today = adminVisitSlots("2026-10-01", NOW, HOURS);
    expect(today[0]).toBe("11:00 AM – 11:30 AM");
    expect(today.at(-1)).toBe("9:30 PM – 10:00 PM");
  });
});

describe("resolveVisitSlot", () => {
  it("returns the shop-time instants for a valid slot", () => {
    const { startsAt, endsAt } = resolveVisitSlot("2026-10-03", "4:30 PM – 5:00 PM", NOW, HOURS);
    expect(startsAt.toISOString()).toBe("2026-10-03T20:30:00.000Z");
    expect(endsAt.toISOString()).toBe("2026-10-03T21:00:00.000Z");
  });

  it("refuses malformed dates, off-grid slots and slots that have started", () => {
    expect(() => resolveVisitSlot("10/03/2026", "4:30 PM – 5:00 PM", NOW, HOURS)).toThrow(VisitSlotError);
    expect(() => resolveVisitSlot("2026-10-03", "4:45 PM – 5:15 PM", NOW, HOURS)).toThrow(VisitSlotError);
    expect(() => resolveVisitSlot("2026-10-01", "8:00 AM – 8:30 AM", NOW, HOURS)).toThrow(VisitSlotError);
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

describe("the owner's slots follow the stored hours", () => {
  // 2026-10-03 is a Saturday (weekday 6).
  const hours = HOURS.map((h) => (h.weekday === 6 ? { ...h, opensAt: 10 * 60, closesAt: 12 * 60 } : h));

  it("offers only the slots inside that day's hours, with no lead time", () => {
    expect(adminVisitSlots("2026-10-03", NOW, hours)).toEqual(["10:00 AM – 10:30 AM", "10:30 AM – 11:00 AM", "11:00 AM – 11:30 AM", "11:30 AM – 12:00 PM"]);
    expect(() => resolveVisitSlot("2026-10-03", "4:30 PM – 5:00 PM", NOW, hours)).toThrow(VisitSlotError);
    expect(() => resolveVisitSlot("2026-10-03", "10:30 AM – 11:00 AM", NOW, hours)).not.toThrow();
  });

  it("offers nothing on a closed day", () => {
    const closed = HOURS.map((h) => (h.weekday === 6 ? { ...h, isOpen: false } : h));
    expect(adminVisitSlots("2026-10-03", NOW, closed)).toEqual([]);
    expect(() => resolveVisitSlot("2026-10-03", "10:30 AM – 11:00 AM", NOW, closed)).toThrow(VisitSlotError);
  });
});
