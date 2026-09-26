import { describe, expect, it } from "vitest";
import { computeMultiServicePricing, RUSH_FEE, SUEDE_FEE } from "./pricing";

const standardClean = { name: "Standard Clean", price: "$30", priceNote: "+$10 for Suede", suedeFee: true };
const premiumClean = { name: "Premium Clean", price: "$50", priceNote: "+$10 for Suede", suedeFee: true };
const oxidation = { name: "Oxidation Restoration", price: "Midsole from $25+", priceNote: "Sole from $40+" };
const painting = { name: "Sneaker Painting & Dyeing", price: "Starting at $40+" };
const revivalPack = { name: "The Revival Pack", price: "$150" };

describe("computeMultiServicePricing", () => {
  it("returns a 'no service selected' placeholder for an empty selection", () => {
    const result = computeMultiServicePricing([], "", false);
    expect(result).toEqual({ name: "No service selected", price: "$0", priceNote: undefined });
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
