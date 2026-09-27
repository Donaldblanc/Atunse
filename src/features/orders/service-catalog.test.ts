import { describe, expect, it } from "vitest";
import { Money } from "@/shared/money/money";
import { BOOKING_SERVICES } from "@/features/booking/services-data";
import {
  estimateItem,
  estimateOrder,
  InvalidServiceSelectionError,
  RUSH_FEE_CENTS,
  SERVICE_CATALOG,
  SUEDE_FEE_CENTS,
} from "./service-catalog";

describe("estimateItem", () => {
  it("prices a single flat service", () => {
    const result = estimateItem({ serviceIds: ["standard"], material: "Leather" });
    expect(result.estimate.cents).toBe(3000);
    expect(result.isMinimum).toBe(false);
  });

  it("adds the Suede Fee once, only when the material is Suede and a cleaning tier is selected", () => {
    expect(estimateItem({ serviceIds: ["standard"], material: "Suede" }).estimate.cents).toBe(3000 + SUEDE_FEE_CENTS);
    expect(estimateItem({ serviceIds: ["oxidation"], material: "Suede" }).estimate.cents).toBe(2500);
    expect(estimateItem({ serviceIds: ["standard"], material: null }).estimate.cents).toBe(3000);
  });

  it("sums additive services and marks range-priced ones as a minimum", () => {
    const result = estimateItem({ serviceIds: ["premium", "oxidation", "painting"], material: "Canvas" });
    expect(result.estimate.cents).toBe(5000 + 2500 + 4000);
    expect(result.isMinimum).toBe(true);
  });

  it("rejects an empty selection, unknown ids, duplicates, and two cleaning tiers", () => {
    expect(() => estimateItem({ serviceIds: [], material: null })).toThrow(InvalidServiceSelectionError);
    expect(() => estimateItem({ serviceIds: ["deluxe"], material: null })).toThrow(InvalidServiceSelectionError);
    expect(() => estimateItem({ serviceIds: ["reglue", "reglue"], material: null })).toThrow(InvalidServiceSelectionError);
    expect(() => estimateItem({ serviceIds: ["standard", "premium"], material: null })).toThrow(
      InvalidServiceSelectionError,
    );
  });
});

describe("estimateOrder", () => {
  it("adds Rush once per Order and takes a 50% Deposit", () => {
    const item = estimateItem({ serviceIds: ["standard"], material: "Leather" });
    const result = estimateOrder({ items: [item], rush: true });
    expect(result.estimate.cents).toBe(3000 + RUSH_FEE_CENTS);
    expect(result.deposit.cents).toBe(2500);
  });

  it("rounds the Deposit down to the cent", () => {
    const result = estimateOrder({ items: [{ estimate: Money.fromCents(2525), isMinimum: true }], rush: false });
    expect(result.deposit.cents).toBe(1262);
    expect(result.isMinimum).toBe(true);
  });
});

// services-data.ts carries the customer-facing price strings; the catalog
// carries the cents the Deposit is computed from. They must never disagree.
describe("catalog / booking display parity", () => {
  it.each(BOOKING_SERVICES.map((s) => [s.id, s] as const))("%s matches its display price", (id, display) => {
    const catalog = SERVICE_CATALOG.find((s) => s.id === id);
    expect(catalog, `no catalog entry for ${id}`).toBeDefined();
    const leadingDollars = parseInt(display.price.match(/\d+/)![0], 10);
    expect(catalog!.baseCents).toBe(leadingDollars * 100);
    expect(catalog!.isMinimum).toBe(display.price.endsWith("+"));
    expect(catalog!.suedeFee).toBe(Boolean(display.suedeFee));
    expect(catalog!.isCleaningTier).toBe(display.category === "cleaning");
  });

  it("has no catalog entry the booking UI can't show", () => {
    expect(SERVICE_CATALOG.map((s) => s.id).sort()).toEqual(BOOKING_SERVICES.map((s) => s.id).sort());
  });
});
