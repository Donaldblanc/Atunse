import { Crown, Droplet, Palette, Ribbon, ShieldCheck, Snowflake, Sparkles, SportShoe, Wind, type LucideIcon } from "lucide-react";
import type { ServiceCategoryId } from "@/features/landing/services";
import { addOnServices, isBundleAvailable, type Catalog, type CatalogBundle, type CatalogService } from "@/features/orders/service-catalog";
import type { PricedLine } from "./pricing";

export type BookingService = {
  /** A catalog Service id: prices, the Suede fee and minimums all come from the catalog. */
  id: string;
  name: string;
  description: string;
  badge?: string;
  icon: LucideIcon;
  category: ServiceCategoryId;
};

// Presentation only (icon, badge), keyed by Service id. Names, descriptions,
// prices and which Services exist come from the catalog the owner edits in
// admin; a Service without an entry here still renders, with a default icon
// and its own description.
//
// "protection" has no main SKU of its own: per services/page.tsx's
// Standard/Premium Clean checklist ("Finished with Crep Protection Shoe
// Deodorizer & Protection Spray"), protection is a finishing treatment
// bundled into every clean. The Waterproof Seal and Premium Deodorizing
// Treatment go further, as optional Add-ons (bookingAddOns below).
const SERVICE_PRESENTATION: Record<string, { icon: LucideIcon; badge?: string }> = {
  standard: { icon: SportShoe },
  premium: { icon: Crown, badge: "MOST POPULAR" },
  oxidation: { icon: Sparkles },
  painting: { icon: Palette },
  reglue: { icon: Droplet },
};

const DEFAULT_ICON: LucideIcon = Sparkles;

/** The landing-page category a catalog Service is grouped under (ServiceStep). */
function landingCategory(service: CatalogService): ServiceCategoryId {
  return service.category === "additional" ? "protection" : service.category;
}

/** The Services a customer can book as a pair's main Service: active, and not an Add-on. */
export function bookingServices(catalog: Catalog): BookingService[] {
  return catalog.services
    .filter((service) => service.active && !service.isAddOn)
    .map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      badge: SERVICE_PRESENTATION[service.id]?.badge,
      icon: SERVICE_PRESENTATION[service.id]?.icon ?? DEFAULT_ICON,
      category: landingCategory(service),
    }));
}

/** An Add-on (a catalog Service with isAddOn) with its icon. */
export type BookingAddOn = { id: string; name: string; description: string; icon: LucideIcon };

const ADD_ON_ICONS: Record<string, LucideIcon> = {
  laces: Ribbon,
  deodorizing: Wind,
  waterproofing: ShieldCheck,
};

// Optional extras chosen per pair in PairForm (CONTEXT.md: Add-on). Names,
// descriptions and prices come from the catalog; only the icon lives here.
export function bookingAddOns(catalog: Catalog): BookingAddOn[] {
  return addOnServices(catalog)
    .filter((service) => service.active)
    .map((service) => ({ id: service.id, name: service.name, description: service.description, icon: ADD_ON_ICONS[service.id] ?? DEFAULT_ICON }));
}

/** A catalog Bundle plus its icon. */
export type BookingBundle = CatalogBundle & { icon: LucideIcon };

// 3-pair bundles: an alternate booking flow to bookingServices for
// customers booking three pairs at once. Name, price and perks come from
// the catalog, which the server prices Bundles from too; only the icon
// lives here.
const BUNDLE_ICONS: Record<string, LucideIcon> = {
  revival: Crown,
  restoration: Sparkles,
  collector: Palette,
  "fall-boots": Snowflake,
};

/** The Bundles a customer can book now: active, and not past their end date. */
export function bookingBundles(catalog: Catalog, now: Date): BookingBundle[] {
  return catalog.bundles
    .filter((bundle) => bundle.active && isBundleAvailable(bundle, now))
    .map((bundle) => ({ ...bundle, icon: BUNDLE_ICONS[bundle.id] ?? Crown }));
}

export function pricedLineForBundle(bundle: BookingBundle): PricedLine {
  // Bundles waive the Suede fee and are flat-priced.
  return { name: bundle.name, baseCents: bundle.priceCents, isMinimum: false, suedeFeeCents: 0, notes: [] };
}
