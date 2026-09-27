import { Crown, Droplet, Palette, Ribbon, ShieldCheck, Sparkles, SportShoe, Wind, type LucideIcon } from "lucide-react";
import type { ServiceCategoryId } from "@/features/landing/services";
import { ADD_ON_SERVICES, BUNDLE_CATALOG, type CatalogBundle } from "@/features/orders/service-catalog";
import type { PricedLine } from "./pricing";

export type BookingService = {
  /** A SERVICE_CATALOG id: prices, the Suede fee and minimums all come from there. */
  id: string;
  name: string;
  description: string;
  badge?: string;
  icon: LucideIcon;
  category: ServiceCategoryId;
};

// Granular SKUs for the booking flow: presentation only (copy, icon,
// badge). Each `id` is a SERVICE_CATALOG entry, where its price lives
// (src/features/orders/service-catalog.ts). Each carries a `category`
// linking it to a landing-page service category
// (src/features/landing/services.ts) — ServiceStep groups this list under
// each category's title using it.
//
// "protection" has no main SKU of its own: per services/page.tsx's
// Standard/Premium Clean checklist ("Finished with Crep Protection Shoe
// Deodorizer & Protection Spray"), protection is a finishing treatment
// bundled into every clean. The Waterproof Seal and Premium Deodorizing
// Treatment go further, as optional Add-ons (BOOKING_ADD_ONS below).
export const BOOKING_SERVICES: BookingService[] = [
  {
    id: "standard",
    name: "Standard Clean",
    description: "A deep, thorough clean to keep your sneakers looking and feeling fresh.",
    icon: SportShoe,
    category: "cleaning",
  },
  {
    id: "premium",
    name: "Premium Clean",
    description: "Our most detailed clean, designed for high-end and heavily worn pairs.",
    badge: "MOST POPULAR",
    icon: Crown,
    category: "cleaning",
  },
  {
    id: "oxidation",
    name: "Oxidation Restoration",
    description: "Reduces yellowing and discoloration, restoring the clean, bright appearance of oxidized soles.",
    icon: Sparkles,
    category: "restoration",
  },
  {
    id: "painting",
    name: "Sneaker Painting & Dyeing",
    description: "Custom color changes, touch-ups, and dye work to refresh, restore, or transform your shoes.",
    icon: Palette,
    category: "custom-work",
  },
  {
    id: "reglue",
    name: "Reglue",
    description: "Professional sole separation repair to securely reattach and restore your sneakers.",
    icon: Droplet,
    category: "restoration",
  },
];

/** An Add-on (a SERVICE_CATALOG entry with isAddOn) with its copy and icon. */
export type BookingAddOn = { id: string; name: string; description: string; icon: LucideIcon };

const ADD_ON_COPY: Record<string, { description: string; icon: LucideIcon }> = {
  laces: { description: "Fresh new laces to finish the look.", icon: Ribbon },
  deodorizing: { description: "A deeper odor treatment that leaves the inside fresh.", icon: Wind },
  waterproofing: { description: "A seal against rain, stains, and the unexpected.", icon: ShieldCheck },
};

// Optional extras chosen per pair in PairForm (CONTEXT.md: Add-on). Names
// and prices come from SERVICE_CATALOG; only the copy and icon live here.
export const BOOKING_ADD_ONS: BookingAddOn[] = ADD_ON_SERVICES.map((service) => ({
  id: service.id,
  name: service.name,
  description: ADD_ON_COPY[service.id]?.description ?? "",
  icon: ADD_ON_COPY[service.id]?.icon ?? Sparkles,
}));

/** A catalog Bundle (BUNDLE_CATALOG) plus its icon. */
export type BookingBundle = CatalogBundle & { icon: LucideIcon };

// 3-pair bundles: an alternate booking flow to BOOKING_SERVICES for
// customers booking three pairs at once. Name, price and perks come from
// BUNDLE_CATALOG in service-catalog.ts, which the server prices Bundles
// from too; only the icon lives here.
const BUNDLE_ICONS: Record<string, LucideIcon> = { revival: Crown, restoration: Sparkles, collector: Palette };

export const BOOKING_BUNDLES: BookingBundle[] = BUNDLE_CATALOG.map((bundle) => ({
  ...bundle,
  icon: BUNDLE_ICONS[bundle.id] ?? Crown,
}));

export function pricedLineForBundle(bundle: BookingBundle): PricedLine {
  // Bundles waive the Suede fee and are flat-priced.
  return { name: bundle.name, baseCents: bundle.priceCents, isMinimum: false, suedeFee: false, notes: [] };
}
