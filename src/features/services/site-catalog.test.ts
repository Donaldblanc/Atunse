import { describe, expect, it } from "vitest";
import { makeBundle, makeService } from "./use-cases/test-fixtures";
import { recordsToCatalog } from "./site-catalog";

describe("recordsToCatalog", () => {
  it("maps database categories to the site's, in position order", () => {
    const catalog = recordsToCatalog(
      [
        makeService({ id: "laces", category: "ADDITIONAL", isAddOn: true, isCleaningTier: false, position: 2 }),
        makeService({ id: "reglue", category: "CUSTOM_WORK", isCleaningTier: false, position: 1 }),
        makeService({ id: "standard", category: "CLEANING", position: 0 }),
      ],
      [makeBundle({ id: "b", position: 1 }), makeBundle({ id: "a", position: 0 })],
    );
    expect(catalog.services.map((s) => [s.id, s.category])).toEqual([
      ["standard", "cleaning"],
      ["reglue", "custom-work"],
      ["laces", "additional"],
    ]);
    expect(catalog.bundles.map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("carries the fields the site prices and shows from, inactive ones included", () => {
    const catalog = recordsToCatalog(
      [
        makeService({
          id: "oxidation",
          category: "RESTORATION",
          isMinimum: true,
          baseCents: 2500,
          suedeFeeCents: 0,
          minimumLabel: "Midsole",
          alsoFrom: [{ label: "Sole", cents: 4000 }],
          active: false,
        }),
      ],
      [makeBundle({ id: "fall-boots", active: false, pairServiceIds: ["standard"], endsAt: new Date("2026-12-22T05:00:00Z") })],
    );
    expect(catalog.services[0]).toEqual({
      id: "oxidation",
      name: "Standard Clean",
      description: "Deep clean, sanitize, and refresh.",
      category: "restoration",
      active: false,
      isCleaningTier: true,
      isAddOn: false,
      baseCents: 2500,
      isMinimum: true,
      suedeFeeCents: 0,
      minimumLabel: "Midsole",
      alsoFrom: [{ label: "Sole", cents: 4000 }],
    });
    expect(catalog.bundles[0]).toMatchObject({ id: "fall-boots", active: false, pairServiceIds: ["standard"], endsAt: "2026-12-22T05:00:00.000Z" });
  });

  it("omits an empty minimum label, empty alsoFrom and a missing end date, and is serializable", () => {
    const catalog = recordsToCatalog([makeService()], [makeBundle()]);
    expect(catalog.services[0]).not.toHaveProperty("alsoFrom");
    expect(catalog.services[0]).not.toHaveProperty("minimumLabel");
    expect(catalog.bundles[0]).not.toHaveProperty("endsAt");
    expect(JSON.parse(JSON.stringify(catalog))).toEqual(catalog);
  });
});
