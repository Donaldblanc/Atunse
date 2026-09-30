import { CalendarCheck, Package, Sparkles, Truck, type LucideIcon } from "lucide-react";
import type { GalleryImage } from "./gallery";

// The /process page: how an Order gets from booking back onto the
// customer's feet. The photos are cropped from the approved design
// (public/images/landing/README.txt). A pair comes in by Local Drop-Off
// (DJ collects it, NY/NJ/CT) or Mail-In only (CONTEXT.md), and the copy
// has to say so.

export const PROCESS_HERO_IMAGE: GalleryImage = {
  key: "process-hero.jpg",
  alt: "Close-up of a clean white and grey Air Jordan 1 heel",
};

export interface ProcessStep {
  icon: LucideIcon;
  title: string;
  description: string;
  image: GalleryImage;
}

export const PROCESS_STEPS: ProcessStep[] = [
  {
    icon: CalendarCheck,
    title: "Book Your Service",
    description: "Choose your service, get an instant estimate, and book in just a few clicks.",
    image: { key: "process-step-book.jpg", alt: "Choosing a service in the Atunṣe booking flow on a phone" },
  },
  {
    icon: Truck,
    title: "Local Drop-Off or Mail In",
    description: "Book a Local Drop-Off and DJ collects your pair from your address, or ship it to us.",
    image: { key: "process-step-pickup.jpg", alt: "An Atunṣe shoe box ready to send" },
  },
  {
    icon: Sparkles,
    title: "We Inspect and Clean",
    description: "Our team carefully inspects, cleans, and restores your sneakers, choosing methods for each material.",
    image: { key: "process-step-clean.jpg", alt: "A gloved hand scrubbing a white sneaker with a brush and foam" },
  },
  {
    icon: Package,
    title: "Wear Your Sneakers",
    description: "Once your pair passes our final quality check, DJ drops it back off or we ship it back.",
    image: { key: "process-step-wear.jpg", alt: "A freshly cleaned pair of sneakers beside an Atunṣe box" },
  },
];
