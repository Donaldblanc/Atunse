// The catalog as it was seeded, for tests, test fixtures and in-memory
// repositories only (ADR-0016): the site and booking read the services and
// bundles tables through features/services/site-catalog.ts. No runtime
// file imports this.

import type { SiteSettings } from "@/features/settings/use-cases/get-site-settings";
import type { Catalog } from "./service-catalog";

export const DEFAULT_CATALOG: Catalog = {
  services: [
    { id: "standard", name: "Standard Clean", description: "A deep, thorough clean to keep your sneakers looking and feeling fresh.", category: "cleaning", active: true, isCleaningTier: true, isAddOn: false, baseCents: 3000, isMinimum: false, suedeFeeCents: 1000 },
    { id: "premium", name: "Premium Clean", description: "Our most detailed clean, designed for high-end and heavily worn pairs.", category: "cleaning", active: true, isCleaningTier: true, isAddOn: false, baseCents: 5000, isMinimum: false, suedeFeeCents: 1000 },
    {
      id: "oxidation",
      name: "Oxidation Restoration",
      description: "Treats yellowing and discoloration to brighten oxidized soles.",
      category: "restoration",
      active: true,
      isCleaningTier: false,
      isAddOn: false,
      baseCents: 2500,
      isMinimum: true,
      suedeFeeCents: 0,
      minimumLabel: "Midsole",
      alsoFrom: [{ label: "Sole", cents: 4000 }],
    },
    { id: "painting", name: "Sneaker Painting & Dyeing", description: "Custom color changes, touch-ups, and dye work to refresh, restore, or transform your shoes.", category: "custom-work", active: true, isCleaningTier: false, isAddOn: false, baseCents: 4000, isMinimum: true, suedeFeeCents: 0 },
    { id: "reglue", name: "Reglue", description: "Professional repair for sole separation, reattaching soles that have come loose.", category: "restoration", active: true, isCleaningTier: false, isAddOn: false, baseCents: 5000, isMinimum: true, suedeFeeCents: 0 },
    // Add-ons: flat-priced, no Suede Fee.
    { id: "laces", name: "Lace Replacement", description: "Fresh new laces to finish the look.", category: "additional", active: true, isCleaningTier: false, isAddOn: true, baseCents: 1500, isMinimum: false, suedeFeeCents: 0 },
    { id: "deodorizing", name: "Premium Deodorizing Treatment", description: "A deeper odor treatment that leaves the inside fresh.", category: "additional", active: true, isCleaningTier: false, isAddOn: true, baseCents: 1000, isMinimum: false, suedeFeeCents: 0 },
    { id: "waterproofing", name: "Waterproof Seal", description: "A seal against rain, stains, and the unexpected.", category: "additional", active: true, isCleaningTier: false, isAddOn: true, baseCents: 500, isMinimum: false, suedeFeeCents: 0 },
  ],
  bundles: [
    {
      id: "revival",
      name: "The Revival Pack",
      priceCents: 15000,
      active: true,
      pairServiceIds: ["premium"],
      perks: ["Premium Clean (all 3 pairs)", "Suede fee waived", "Priority turnaround", "Oxidation touch-up on 1 pair"],
    },
    {
      id: "restoration",
      name: "The Restoration Trio",
      priceCents: 17500,
      active: true,
      pairServiceIds: ["premium"],
      perks: ["Premium Clean (all 3 pairs)", "Suede fee waived", "Deep sole whitening (all pairs)", "Oxidation midsole on 1 pair"],
    },
    {
      id: "collector",
      name: "The Collector’s Triple",
      priceCents: 20000,
      active: true,
      pairServiceIds: ["premium"],
      perks: [
        "Premium Clean (all 3 pairs)",
        "Suede fee waived",
        "Oxidation midsole (2 pairs)",
        "Reglue inspection",
        "Paint/dye touch-up on 1 pair",
        "VIP turnaround (typically 48–72 hours)",
      ],
    },
    {
      id: "fall-boots",
      name: "Start of Fall Special: 3 Boots",
      priceCents: 12000,
      active: true,
      perks: [
        "Basic Clean, Boot Restoration or Fall Finish, chosen after inspection",
        "Deep clean, stain lift, scuff repair, suede revival",
        "UGGs, Timberlands, any boot type",
        "Suede fee waived",
        "Typical turnaround 3–7 business days",
      ],
      pairServiceIds: ["standard"],
      // End of December 21st 2026, New York time (EST, UTC-5).
      endsAt: "2026-12-22T05:00:00Z",
    },
  ],
};

/** Settings as it was seeded (every weekday 8 AM - 10 PM, both Fulfillment Methods on), for tests. */
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  hours: Array.from({ length: 7 }, (_, weekday) => ({ weekday, isOpen: true, opensAt: 8 * 60, closesAt: 22 * 60 })),
  allowLocalDropOff: true,
  allowMailIn: true,
  businessName: "Atunṣe",
  email: null,
  phone: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  zip: null,
};
