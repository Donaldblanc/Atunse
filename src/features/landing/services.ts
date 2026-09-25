import { Droplets, Wrench, ShieldCheck, Palette, type LucideIcon } from "lucide-react";
import { SERVICE_IMAGES, type GalleryImage } from "./gallery";

export type ServiceCategory = {
  id: string;
  title: string;
  description: string;
  image: GalleryImage;
  icon: LucideIcon;
};

// Canonical service categories shown on the landing page's Services grid.
// No compile-time link to src/features/booking/services-data.ts's
// BOOKING_SERVICES — a `category` field was tried in #39/#54 but had no
// real consumer, so it was removed (see the comment there).
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
