import { describe, expect, it } from "vitest";
import { estimateBundleItems, estimateItem, estimateOrder, MATERIALS, RUSH_FEE_CENTS, SERVICE_CATALOG, SUEDE_FEE_CENTS } from "@/features/orders/service-catalog";

const RUSH_FEE = RUSH_FEE_CENTS / 100;
const SUEDE_FEE = SUEDE_FEE_CENTS / 100;
import { computeMultiServicePricing, pricedLineForService } from "./pricing";
import { BOOKING_BUNDLES, pricedLineForBundle } from "./services-data";

const standardClean = pricedLineForService("standard");
const premiumClean = pricedLineForService("premium");
const oxidation = pricedLineForService("oxidation");
const painting = pricedLineForService("painting");
const revivalPack = pricedLineForBundle(BOOKING_BUNDLES.find((b) => b.id === "revival")!);

describe("computeMultiServicePricing", () => {
  it("returns a 'no service selected' placeholder for an empty selection", () => {
    const result = computeMultiServicePricing([], "", false);
    expect(result).toEqual({ name: "No service selected", totalCents: 0, isMinimum: false, price: "$0", priceNote: undefined });
  });

  it("prices a single flat service with no material or rush", () => {
    const result = computeMultiServicePricing([standardClean], "", false);
    expect(result.name).toBe("Standard Clean");
    expect(result.price).toBe("$30");
    expect(result.priceNote).toBe("+$10 for Suede");
  });

  it("adds the suede fee only when the material is actually Suede", () => {
    const notSuede = computeMultiServicePricing([standardClean], "Canvas", false);
    expect(notSuede.price).toBe("$30");

    const suede = computeMultiServicePricing([standardClean], "Suede", false);
    expect(suede.price).toBe("$40");
    expect(suede.priceNote).toBe("Includes +$10 Suede fee");
  });

  it("never applies the suede fee to a service without suedeFee: true", () => {
    const result = computeMultiServicePricing([oxidation], "Suede", false);
    expect(result.price).toBe("$25+");
    expect(result.priceNote).toBe("Sole from $40+");
  });

  it("adds the rush fee on top of the base price", () => {
    const result = computeMultiServicePricing([standardClean], "Canvas", true);
    expect(result.price).toBe("$50"); // $30 base + $20 rush
    expect(result.priceNote).toBe(`+$10 for Suede · +$${RUSH_FEE} rush`);
  });

  it("adds the rush fee with no suede-fee note for a service that doesn't carry one", () => {
    const result = computeMultiServicePricing([oxidation], "Canvas", true);
    expect(result.priceNote).toBe(`Sole from $40+ · +$${RUSH_FEE} rush`);
  });

  it("stacks suede and rush together", () => {
    const result = computeMultiServicePricing([standardClean], "Suede", true);
    expect(result.price).toBe(`$${30 + SUEDE_FEE + RUSH_FEE}`);
    expect(result.priceNote).toBe(`Includes +$${SUEDE_FEE} Suede fee · +$${RUSH_FEE} rush`);
  });

  it("combines multiple additive services into one name and summed price", () => {
    const result = computeMultiServicePricing([premiumClean, oxidation, painting], "Canvas", false);
    expect(result.name).toBe("Premium Clean + Oxidation Restoration + Sneaker Painting & Dyeing");
    // 50 (premium) + 25 (oxidation's leading number) + 40 (painting) = 115
    expect(result.price).toBe("$115+");
  });

  it("preserves a non-suede service's own priceNote alongside the generated notes", () => {
    const result = computeMultiServicePricing([oxidation], "Canvas", false);
    expect(result.priceNote).toBe("Sole from $40+");
  });

  it("drops a suedeFee service's own priceNote in favor of the generated suede note (no duplicate)", () => {
    const result = computeMultiServicePricing([standardClean], "Suede", false);
    expect(result.priceNote).toBe("Includes +$10 Suede fee");
  });

  it("charges the suede fee once even when several selected services carry it", () => {
    const result = computeMultiServicePricing([standardClean, premiumClean], "Suede", false);
    expect(result.price).toBe(`$${30 + 50 + SUEDE_FEE}`);
    expect(result.priceNote).toBe(`Includes +$${SUEDE_FEE} Suede fee`);
  });

  it("appends a trailing '+' only when a range-priced service is in the mix", () => {
    const allFlat = computeMultiServicePricing([standardClean, premiumClean], "Canvas", false);
    expect(allFlat.price).toBe("$80");

    const withRange = computeMultiServicePricing([standardClean, oxidation], "Canvas", false);
    expect(withRange.price).toBe("$55+");
  });

  it("prices a bundle the same way a flat-priced service prices, rush included", () => {
    const result = computeMultiServicePricing([revivalPack], "", true);
    expect(result.name).toBe("The Revival Pack");
    expect(result.price).toBe(`$${150 + RUSH_FEE}`);
    expect(result.priceNote).toBe(`+$${RUSH_FEE} rush`);
  });
});

// The booking summary and the server must never disagree about a total:
// check every valid selection (at most one cleaning tier) × material × rush.
describe("client total vs server estimate", () => {
  const cleaning = SERVICE_CATALOG.filter((s) => s.isCleaningTier).map((s) => s.id);
  const addons = SERVICE_CATALOG.filter((s) => !s.isCleaningTier).map((s) => s.id);
  const addonSets = addons.reduce<string[][]>((sets, id) => [...sets, ...sets.map((set) => [...set, id])], [[]]);
  const selections = [null, ...cleaning]
    .flatMap((tier) => addonSets.map((set) => [...(tier ? [tier] : []), ...set]))
    .filter((ids) => ids.length > 0);

  it.each(selections.map((ids) => [ids.join(" + "), ids] as const))("%s", (_label, ids) => {
    for (const material of [...MATERIALS, ""]) {
      for (const rush of [false, true]) {
        const client = computeMultiServicePricing(ids.map(pricedLineForService), material, rush);
        const item = estimateItem({ serviceIds: [...ids], material: material === "" ? null : (material as (typeof MATERIALS)[number]) });
        const server = estimateOrder({ items: [item], rush });
        expect(client.totalCents).toBe(server.estimate.cents);
        expect(client.isMinimum).toBe(server.isMinimum);
        expect(client.price.endsWith("+")).toBe(server.isMinimum);
      }
    }
  });
});

describe("client Bundle total vs server estimate", () => {
  it.each(BOOKING_BUNDLES.map((bundle) => [bundle.name, bundle] as const))("%s", (_label, bundle) => {
    for (const rush of [false, true]) {
      const client = computeMultiServicePricing([pricedLineForBundle(bundle)], "", rush);
      const server = estimateOrder({ items: estimateBundleItems(bundle.id), rush });
      expect(client.totalCents).toBe(server.estimate.cents);
      expect(client.isMinimum).toBe(server.isMinimum);
    }
  });
});
