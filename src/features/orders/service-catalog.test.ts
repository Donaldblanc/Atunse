import { describe, expect, it } from "vitest";
import { RATE_LIMITS } from "@/shared/rate-limit/rate-limiter";
import { Money } from "@/shared/money/money";
import { bookingAddOns, bookingServices } from "@/features/booking/services-data";
import { DEFAULT_CATALOG } from "./default-catalog";
import {
  BUNDLE_PAIRS,
  bundlePairServiceIds,
  catalogBundle,
  catalogService,
  estimateBundleItems,
  formatServicePrice,
  serviceNotes,
  estimateItem,
  estimateOrder,
  InvalidServiceSelectionError,
  isBundleAvailable,
  itemRequiresQuote,
  RUSH_FEE_CENTS,
  assertBundleBookable,
  assertServicesBookable,
  bundleName,
  serviceName,
  suedeFeeCents,
  type Catalog,
} from "./service-catalog";

const C = DEFAULT_CATALOG;
const STANDARD_SUEDE_FEE = 1000;

describe("estimateItem", () => {
  it("prices a single flat service", () => {
    const result = estimateItem(C, { serviceIds: ["standard"], material: "Leather" });
    expect(result.estimate.cents).toBe(3000);
    expect(result.isMinimum).toBe(false);
  });

  it("adds the Suede Fee once, only when the material is Suede and a cleaning tier is selected", () => {
    expect(estimateItem(C, { serviceIds: ["standard"], material: "Suede" }).estimate.cents).toBe(3000 + STANDARD_SUEDE_FEE);
    expect(estimateItem(C, { serviceIds: ["oxidation"], material: "Suede" }).estimate.cents).toBe(2500);
    expect(estimateItem(C, { serviceIds: ["standard"], material: null }).estimate.cents).toBe(3000);
  });

  it("sums additive services and marks range-priced ones as a minimum", () => {
    const result = estimateItem(C, { serviceIds: ["premium", "oxidation", "painting"], material: "Canvas" });
    expect(result.estimate.cents).toBe(5000 + 2500 + 4000);
    expect(result.isMinimum).toBe(true);
  });

  it("rejects an empty selection, unknown ids, duplicates, and two cleaning tiers", () => {
    expect(() => estimateItem(C, { serviceIds: [], material: null })).toThrow(InvalidServiceSelectionError);
    expect(() => estimateItem(C, { serviceIds: ["deluxe"], material: null })).toThrow(InvalidServiceSelectionError);
    expect(() => estimateItem(C, { serviceIds: ["reglue", "reglue"], material: null })).toThrow(InvalidServiceSelectionError);
    expect(() => estimateItem(C, { serviceIds: ["standard", "premium"], material: null })).toThrow(
      InvalidServiceSelectionError,
    );
  });
});

describe("Add-ons (CONTEXT.md: Add-on)", () => {
  it("adds each Add-on's flat price to the pair, with no Suede Fee and no minimum", () => {
    const result = estimateItem(C, { serviceIds: ["standard", "laces", "deodorizing", "waterproofing"], material: "Suede" });
    expect(result.estimate.cents).toBe(3000 + STANDARD_SUEDE_FEE + 1500 + 1000 + 500);
    expect(result.isMinimum).toBe(false);
  });

  it("goes with any main Service, restoration included", () => {
    expect(estimateItem(C, { serviceIds: ["reglue", "laces"], material: null }).estimate.cents).toBe(5000 + 1500);
  });

  it("is never booked on its own", () => {
    expect(() => estimateItem(C, { serviceIds: ["laces"], material: null })).toThrow(/Add-ons go with a cleaning or restoration service/);
    expect(() => estimateItem(C, { serviceIds: ["laces", "waterproofing"], material: null })).toThrow(InvalidServiceSelectionError);
  });

  it("can't be chosen twice on one pair", () => {
    expect(() => estimateItem(C, { serviceIds: ["standard", "laces", "laces"], material: null })).toThrow(InvalidServiceSelectionError);
  });
});

describe("estimateBundleItems", () => {
  it("splits every Bundle into three flat shares that sum to exactly its price", () => {
    for (const bundle of C.bundles) {
      const shares = estimateBundleItems(C, bundle.id);
      expect(shares).toHaveLength(BUNDLE_PAIRS);
      expect(shares.reduce((sum, share) => sum + share.estimate.cents, 0)).toBe(bundle.priceCents);
      expect(Math.max(...shares.map((s) => s.estimate.cents)) - Math.min(...shares.map((s) => s.estimate.cents))).toBeLessThanOrEqual(1);
      expect(shares.every((share) => !share.isMinimum)).toBe(true);
    }
  });

  it("prices the Start of Fall Special at $120, split $40 a pair", () => {
    const shares = estimateBundleItems(C, "fall-boots");
    expect(shares.map((s) => s.estimate.cents)).toEqual([4000, 4000, 4000]);
  });

  it("rejects an unknown Bundle", () => {
    expect(() => estimateBundleItems(C, "mystery")).toThrow(InvalidServiceSelectionError);
  });

  it("adds each pair's own Add-ons on top of its share", () => {
    const shares = estimateBundleItems(C, "revival", [[], ["laces", "deodorizing"], ["waterproofing"]]);
    expect(shares.map((s) => s.estimate.cents)).toEqual([5000, 5000 + 1500 + 1000, 5000 + 500]);
    expect(shares.reduce((sum, s) => sum + s.estimate.cents, 0)).toBe(15000 + 1500 + 1000 + 500);
  });

  it("allows only Add-ons per pair: the Bundle's other Services come with it", () => {
    expect(() => estimateBundleItems(C, "revival", [["premium"], [], []])).toThrow(/only add-ons/);
    expect(() => estimateBundleItems(C, "revival", [["laces", "laces"], [], []])).toThrow(InvalidServiceSelectionError);
  });
});

describe("estimateOrder", () => {
  it("adds Rush once per Order and takes a 50% Deposit", () => {
    const item = estimateItem(C, { serviceIds: ["standard"], material: "Leather" });
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
      C.services.map((s) => [s.id, { price: formatServicePrice(s), notes: serviceNotes(s) }]),
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

  it("offers every active catalog Service in the booking flow, and no others", () => {
    expect(C.services.map((s) => s.id).sort()).toEqual([...bookingServices(C), ...bookingAddOns(C)].map((s) => s.id).sort());
    expect(bookingServices(C).every((s) => !catalogService(C, s.id).isAddOn)).toBe(true);
    expect(bookingAddOns(C).map((a) => [a.name, a.description !== ""])).toEqual([
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

describe("itemRequiresQuote (ADR-0017)", () => {
  it("doesn't need a Quote for cleaning-only, add-on-only, or cleaning + add-on", () => {
    expect(itemRequiresQuote(C, ["standard"])).toBe(false);
    expect(itemRequiresQuote(C, ["premium", "laces"])).toBe(false);
    expect(itemRequiresQuote(C, ["standard", "laces", "deodorizing"])).toBe(false);
  });

  it("needs a Quote for any restoration or custom-work Service, even mixed with cleaning", () => {
    expect(itemRequiresQuote(C, ["oxidation"])).toBe(true);
    expect(itemRequiresQuote(C, ["reglue"])).toBe(true);
    expect(itemRequiresQuote(C, ["painting"])).toBe(true);
    expect(itemRequiresQuote(C, ["standard", "oxidation"])).toBe(true);
  });
});

describe("isBundleAvailable", () => {
  const promo = catalogBundle(C, "fall-boots");

  it("is open until the promotion's end instant, then closed", () => {
    expect(isBundleAvailable(promo, new Date("2026-12-22T04:59:59Z"))).toBe(true);
    expect(isBundleAvailable(promo, new Date("2026-12-22T05:00:00Z"))).toBe(false);
  });

  it("never closes a Bundle without an end date, and gives it Premium Clean", () => {
    const revival = catalogBundle(C, "revival");
    expect(isBundleAvailable(revival, new Date("2099-01-01T00:00:00Z"))).toBe(true);
    expect(bundlePairServiceIds(revival)).toEqual(["premium"]);
    expect(bundlePairServiceIds(promo)).toEqual(["standard"]);
  });
});

describe("the Suede Fee (largest per-service amount, charged once)", () => {
  const withFees = (fees: Record<string, number>): Catalog => ({
    ...C,
    services: C.services.map((s) => (s.id in fees ? { ...s, suedeFeeCents: fees[s.id]! } : s)),
  });

  it("is the largest fee among the selected Services, not their sum", () => {
    const catalog = withFees({ standard: 1000, painting: 2500 });
    expect(suedeFeeCents("Suede", catalog.services.filter((s) => ["standard", "painting"].includes(s.id)))).toBe(2500);
    expect(estimateItem(catalog, { serviceIds: ["standard", "painting"], material: "Suede" }).estimate.cents).toBe(3000 + 4000 + 2500);
    expect(estimateItem(catalog, { serviceIds: ["standard", "painting"], material: "Leather" }).estimate.cents).toBe(3000 + 4000);
  });

  it("is whatever the owner set: zero turns it off", () => {
    expect(estimateItem(withFees({ standard: 0 }), { serviceIds: ["standard"], material: "Suede" }).estimate.cents).toBe(3000);
    expect(estimateItem(withFees({ standard: 1500 }), { serviceIds: ["standard"], material: "Suede" }).estimate.cents).toBe(4500);
  });
});

describe("inactive and ended catalog entries", () => {
  const catalog: Catalog = {
    services: C.services.map((s) => (s.id === "reglue" ? { ...s, active: false } : s)),
    bundles: C.bundles.map((b) => (b.id === "revival" ? { ...b, active: false } : b)),
  };

  it("still price and name past Items, but new bookings refuse them", () => {
    expect(estimateItem(catalog, { serviceIds: ["reglue"], material: null }).estimate.cents).toBe(5000);
    expect(serviceName(catalog, "reglue")).toBe("Reglue");
    expect(() => assertServicesBookable(catalog, ["reglue"])).toThrow(/Reglue isn't available any more/);
    expect(() => assertServicesBookable(catalog, ["standard"])).not.toThrow();
    expect(() => assertBundleBookable(catalog, "revival", new Date("2026-11-01T00:00:00Z"))).toThrow(/isn't available any more/);
    expect(() => assertBundleBookable(catalog, "fall-boots", new Date("2026-12-23T00:00:00Z"))).toThrow("This promotion has ended.");
    expect(assertBundleBookable(catalog, "collector", new Date("2026-11-01T00:00:00Z")).id).toBe("collector");
  });

  it("names an id the catalog no longer has by the raw id instead of throwing", () => {
    expect(serviceName(catalog, "gone")).toBe("gone");
    expect(bundleName(catalog, "gone")).toBe("gone");
    expect(itemRequiresQuote(catalog, ["gone"])).toBe(false);
  });
});
