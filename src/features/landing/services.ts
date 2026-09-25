import { Droplets, Wrench, ShieldCheck, Palette, type LucideIcon } from "lucide-react";
import { SERVICE_IMAGES } from "./gallery";

export type ServiceCategoryId = "cleaning" | "restoration" | "protection" | "custom-work";

export type ServiceCategory = {
  id: ServiceCategoryId;
  title: string;
  description: string;
  image: (typeof SERVICE_IMAGES)[number];
  icon: LucideIcon;
};

// Canonical service categories shown on the landing page's Services grid.
// src/features/booking/services-data.ts's BOOKING_SERVICES (granular SKUs)
// reference these ids via its `category` field.
export const SERVICES: ServiceCategory[] = [
  {
    id: "cleaning",
    title: "Cleaning",
    description: "Deep clean for a like-new look.",
    image: SERVICE_IMAGES[0],
    icon: Droplets,
  },
  {
    id: "restoration",
    title: "Restoration",
    description: "Repair, repaint, replace.",
    image: SERVICE_IMAGES[1],
    icon: Wrench,
  },
  {
    id: "protection",
    title: "Protection",
    description: "Premium treatments.",
    image: SERVICE_IMAGES[2],
    icon: ShieldCheck,
  },
  {
    id: "custom-work",
    title: "Custom Work",
    description: "Color touches & special requests.",
    image: SERVICE_IMAGES[3],
    icon: Palette,
  },
];
