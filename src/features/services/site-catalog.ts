import { cache } from "react";
import type { Catalog, CatalogBundle, CatalogService } from "@/features/orders/service-catalog";
import { buildCatalogDeps } from "./deps";
import type { BundleRecord, ServiceCategory, ServiceRecord } from "./repositories/catalog-repository";

const CATEGORIES: Record<ServiceCategory, CatalogService["category"]> = {
  CLEANING: "cleaning",
  RESTORATION: "restoration",
  CUSTOM_WORK: "custom-work",
  ADDITIONAL: "additional",
};

/** The tables' rows as the plain, serializable Catalog the site and booking use, in display order. */
export function recordsToCatalog(services: ServiceRecord[], bundles: BundleRecord[]): Catalog {
  const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;
  return {
    services: [...services].sort(byPosition).map(
      (s): CatalogService => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: CATEGORIES[s.category],
        active: s.active,
        isCleaningTier: s.isCleaningTier,
        isAddOn: s.isAddOn,
        baseCents: s.baseCents,
        isMinimum: s.isMinimum,
        suedeFeeCents: s.suedeFeeCents,
        ...(s.minimumLabel ? { minimumLabel: s.minimumLabel } : {}),
        ...(s.alsoFrom.length > 0 ? { alsoFrom: s.alsoFrom.map((part) => ({ label: part.label, cents: part.cents })) } : {}),
      }),
    ),
    bundles: [...bundles].sort(byPosition).map(
      (b): CatalogBundle => ({
        id: b.id,
        name: b.name,
        priceCents: b.priceCents,
        perks: [...b.perks],
        active: b.active,
        pairServiceIds: [...b.pairServiceIds],
        ...(b.endsAt ? { endsAt: b.endsAt.toISOString() } : {}),
      }),
    ),
  };
}

/**
 * Server-side only (it reads the database). The Service and Bundle catalog
 * the owner edits in admin, read once per request (React cache). Includes
 * inactive entries: callers decide whether they are shown (customer lists
 * filter to active) or only named (existing Orders).
 */
export const loadCatalog = cache(async (): Promise<Catalog> => {
  const { catalog } = buildCatalogDeps();
  const [services, bundles] = await Promise.all([catalog.listServices(), catalog.listBundles()]);
  return recordsToCatalog(services, bundles);
});
