import { Crown, Droplet, Palette, Sparkles, SportShoe, type LucideIcon } from "lucide-react";

export type BookingService = {
  id: string;
  name: string;
  description: string;
  price: string;
  priceNote?: string;
  badge?: string;
  icon: LucideIcon;
};

// Mirrors the services/pricing list on the home page and services page
// (src/app/page.tsx SERVICES, scratch/landing-mock.html services-page) —
// kept as a separate copy here since this list carries booking-specific
// fields (price display strings, badge) the landing SERVICES array doesn't.
export const BOOKING_SERVICES: BookingService[] = [
  {
    id: "standard",
    name: "Standard Clean",
    description: "A deep, thorough clean to keep your sneakers looking and feeling fresh.",
    price: "$30",
    priceNote: "+$10 for Suede",
    icon: SportShoe,
  },
  {
    id: "premium",
    name: "Premium Clean",
    description: "Our most detailed clean, designed for high-end and heavily worn pairs.",
    price: "$50",
    priceNote: "+$10 for Suede",
    badge: "MOST POPULAR",
    icon: Crown,
  },
  {
    id: "oxidation",
    name: "Oxidation Restoration",
    description: "Reduces yellowing and discoloration, restoring the clean, bright appearance of oxidized soles.",
    price: "Midsole from $25+",
    priceNote: "Sole from $40+",
    icon: Sparkles,
  },
  {
    id: "painting",
    name: "Sneaker Painting & Dyeing",
    description: "Custom color changes, touch-ups, and dye work to refresh, restore, or transform your shoes.",
    price: "Starting at $40+",
    icon: Palette,
  },
  {
    id: "reglue",
    name: "Reglue",
    description: "Professional sole separation repair to securely reattach and restore your sneakers.",
    price: "Starting at $50+",
    icon: Droplet,
  },
];
