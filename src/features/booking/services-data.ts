import { Crown, Droplet, Palette, Sparkles, SportShoe, type LucideIcon } from "lucide-react";
import type { ServiceCategoryId } from "@/features/landing/services";

export type BookingService = {
  id: string;
  name: string;
  description: string;
  price: string;
  priceNote?: string;
  badge?: string;
  icon: LucideIcon;
  category: ServiceCategoryId;
};

// Granular SKUs for the booking flow. Each carries a `category` linking it
// to a landing-page service category (src/features/landing/services.ts) —
// ServiceStep groups this list under each category's title using it.
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
    price: "$30",
    priceNote: "+$10 for Suede",
    icon: SportShoe,
    category: "cleaning",
  },
  {
    id: "premium",
    name: "Premium Clean",
    description: "Our most detailed clean, designed for high-end and heavily worn pairs.",
    price: "$50",
    priceNote: "+$10 for Suede",
    badge: "MOST POPULAR",
    icon: Crown,
    category: "cleaning",
  },
  {
    id: "oxidation",
    name: "Oxidation Restoration",
    description: "Reduces yellowing and discoloration, restoring the clean, bright appearance of oxidized soles.",
    price: "Midsole from $25+",
    priceNote: "Sole from $40+",
    icon: Sparkles,
    category: "restoration",
  },
  {
    id: "painting",
    name: "Sneaker Painting & Dyeing",
    description: "Custom color changes, touch-ups, and dye work to refresh, restore, or transform your shoes.",
    price: "Starting at $40+",
    icon: Palette,
    category: "custom-work",
  },
  {
    id: "reglue",
    name: "Reglue",
    description: "Professional sole separation repair to securely reattach and restore your sneakers.",
    price: "Starting at $50+",
    icon: Droplet,
    category: "restoration",
  },
];

export type BookingBundle = {
  id: string;
  name: string;
  price: string;
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
    price: "$150",
    perks: ["Premium Clean (all 3 pairs)", "Suede fee waived", "Priority turnaround", "Oxidation touch-up on 1 pair"],
    icon: Crown,
  },
  {
    id: "restoration",
    name: "The Restoration Trio",
    price: "$175",
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
    price: "$200",
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
