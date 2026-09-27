import { Crown, Droplet, Palette, Sparkles, SportShoe, type LucideIcon } from "lucide-react";
import type { ServiceCategoryId } from "@/features/landing/services";
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
// "protection" has no SKU of its own: per services/page.tsx's Standard/
// Premium Clean checklist ("Finished with Crep Protection Shoe Deodorizer
// & Protection Spray"), protection is a finishing treatment bundled into
// every clean, not a separately bookable service.
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

export type BookingBundle = {
  id: string;
  name: string;
  /** Flat bundle price. Bundles aren't bookable yet (Phase 2), so they're not in SERVICE_CATALOG. */
  priceCents: number;
  perks: string[];
  icon: LucideIcon;
};

// 3-pair bundles: an alternate booking flow to BOOKING_SERVICES for
// customers booking multiple pairs at once (scratch/landing-mock.html's
// "3-Pair Bundle Flow"). Every bundle includes Premium Clean on all 3
// pairs with the suede fee waived; perks above that vary by tier.
export const BOOKING_BUNDLES: BookingBundle[] = [
  {
    id: "revival",
    name: "The Revival Pack",
    priceCents: 15000,
    perks: ["Premium Clean (all 3 pairs)", "Suede fee waived", "Priority turnaround", "Oxidation touch-up on 1 pair"],
    icon: Crown,
  },
  {
    id: "restoration",
    name: "The Restoration Trio",
    priceCents: 17500,
    perks: [
      "Premium Clean (all 3 pairs)",
      "Suede fee waived",
      "Deep sole whitening (all pairs)",
      "Oxidation midsole on 1 pair",
    ],
    icon: Sparkles,
  },
  {
    id: "collector",
    name: "The Collector’s Triple",
    priceCents: 20000,
    perks: [
      "Premium Clean (all 3 pairs)",
      "Suede fee waived",
      "Oxidation midsole (2 pairs)",
      "Reglue inspection",
      "Paint/dye touch-up on 1 pair",
      "VIP turnaround (48–72 hours)",
    ],
    icon: Palette,
  },
];

export function pricedLineForBundle(bundle: BookingBundle): PricedLine {
  // Bundles waive the Suede fee and are flat-priced.
  return { name: bundle.name, baseCents: bundle.priceCents, isMinimum: false, suedeFee: false, notes: [] };
}
