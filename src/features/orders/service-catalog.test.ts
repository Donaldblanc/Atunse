import { describe, expect, it } from "vitest";
import { RATE_LIMITS } from "@/shared/rate-limit/rate-limiter";
import { Money } from "@/shared/money/money";
import { BOOKING_ADD_ONS, BOOKING_SERVICES } from "@/features/booking/services-data";
import {
  BUNDLE_CATALOG,
  BUNDLE_PAIRS,
  catalogService,
  estimateBundleItems,
  formatServicePrice,
  serviceNotes,
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

describe("Add-ons (CONTEXT.md: Add-on)", () => {
  it("adds each Add-on's flat price to the pair, with no Suede Fee and no minimum", () => {
    const result = estimateItem({ serviceIds: ["standard", "laces", "deodorizing", "waterproofing"], material: "Suede" });
    expect(result.estimate.cents).toBe(3000 + SUEDE_FEE_CENTS + 1500 + 1000 + 500);
    expect(result.isMinimum).toBe(false);
  });

  it("goes with any main Service, restoration included", () => {
    expect(estimateItem({ serviceIds: ["reglue", "laces"], material: null }).estimate.cents).toBe(5000 + 1500);
  });

  it("is never booked on its own", () => {
    expect(() => estimateItem({ serviceIds: ["laces"], material: null })).toThrow(/Add-ons go with a cleaning or restoration service/);
    expect(() => estimateItem({ serviceIds: ["laces", "waterproofing"], material: null })).toThrow(InvalidServiceSelectionError);
  });

  it("can't be chosen twice on one pair", () => {
    expect(() => estimateItem({ serviceIds: ["standard", "laces", "laces"], material: null })).toThrow(InvalidServiceSelectionError);
  });
});

describe("estimateBundleItems", () => {
  it("splits every Bundle into three flat shares that sum to exactly its price", () => {
    for (const bundle of BUNDLE_CATALOG) {
      const shares = estimateBundleItems(bundle.id);
      expect(shares).toHaveLength(BUNDLE_PAIRS);
      expect(shares.reduce((sum, share) => sum + share.estimate.cents, 0)).toBe(bundle.priceCents);
      expect(Math.max(...shares.map((s) => s.estimate.cents)) - Math.min(...shares.map((s) => s.estimate.cents))).toBeLessThanOrEqual(1);
      expect(shares.every((share) => !share.isMinimum)).toBe(true);
    }
  });

  it("rejects an unknown Bundle", () => {
    expect(() => estimateBundleItems("mystery")).toThrow(InvalidServiceSelectionError);
  });

  it("adds each pair's own Add-ons on top of its share", () => {
    const shares = estimateBundleItems("revival", [[], ["laces", "deodorizing"], ["waterproofing"]]);
    expect(shares.map((s) => s.estimate.cents)).toEqual([5000, 5000 + 1500 + 1000, 5000 + 500]);
    expect(shares.reduce((sum, s) => sum + s.estimate.cents, 0)).toBe(15000 + 1500 + 1000 + 500);
  });

  it("allows only Add-ons per pair: the Bundle's other Services come with it", () => {
    expect(() => estimateBundleItems("revival", [["premium"], [], []])).toThrow(/only add-ons/);
    expect(() => estimateBundleItems("revival", [["laces", "laces"], [], []])).toThrow(InvalidServiceSelectionError);
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

// Every price string the site shows is formatted from the catalog. These
// pin the published wording, so a formatting change is a visible decision.
describe("catalog display prices", () => {
  it("formats each Service's headline price and notes as published", () => {
    const shown = Object.fromEntries(
      SERVICE_CATALOG.map((s) => [s.id, { price: formatServicePrice(s), notes: serviceNotes(s) }]),
    );
    expect(shown).toEqual({
      standard: { price: "$30", notes: ["+$10 for Suede"] },
      premium: { price: "$50", notes: ["+$10 for Suede"] },
      oxidation: { price: "Midsole from $25+", notes: ["Sole from $40+"] },
      painting: { price: "Starting at $40+", notes: [] },
      reglue: { price: "Starting at $50+", notes: [] },
      laces: { price: "$15", notes: [] },
      deodorizing: { price: "$10", notes: [] },
      waterproofing: { price: "$5", notes: [] },
    });
  });

  it("has a catalog entry for every Service the booking flow offers, and no others", () => {
    expect(SERVICE_CATALOG.map((s) => s.id).sort()).toEqual([...BOOKING_SERVICES, ...BOOKING_ADD_ONS].map((s) => s.id).sort());
    expect(BOOKING_SERVICES.every((s) => !catalogService(s.id).isAddOn)).toBe(true);
    expect(BOOKING_ADD_ONS.map((a) => [a.name, a.description !== ""])).toEqual([
      ["Lace Replacement", true],
      ["Premium Deodorizing Treatment", true],
      ["Waterproof Seal", true],
    ]);
  });
});

describe("upload rate limit vs Bundles (#85)", () => {
  it("allows ~20 Bundle attempts: one uploads request per pair per attempt", () => {
    expect(RATE_LIMITS.uploads.limit).toBeGreaterThanOrEqual(20 * BUNDLE_PAIRS);
  });
});
