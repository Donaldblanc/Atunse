import type { GalleryImage } from "@/features/landing/gallery";
import type { Faq } from "@/features/landing/faq-accordion";

// /contact's photos (cropped from the approved design, see
// public/images/landing/README.txt) and its "Common questions". The
// answers follow CONTEXT.md: Pickup is NY/NJ/CT only, Mail-In customers
// ship the pair themselves (ADR-0010), there's no drop-off, and every pair
// is priced by the owner before any work (the Approval Gate).

export const CONTACT_HERO_IMAGE: GalleryImage = {
  key: "contact-hero.jpg",
  alt: "A pair of black and white Air Jordan 1 Highs on a shelf",
};

export const CONTACT_FAQ_IMAGE: GalleryImage = {
  key: "contact-faq.jpg",
  alt: "Freshly cleaned sneakers on a studio shelf beside boxes, under a “Restore, Revive, Repeat” sign",
};

export const CONTACT_FAQS: Faq[] = [
  {
    question: "How long does a restoration take?",
    answer:
      "Cleanings take about 72 hours. Restorations usually take 5–10 business days, depending on the work and how busy we are. Need it sooner? Add Rush when you book.",
  },
  {
    question: "Do you offer local pickup?",
    answer: "Yes. We pick up from your address anywhere in the NY / NJ / CT tri-state area. Choose a date and time when you book.",
  },
  {
    question: "Can I ship my sneakers?",
    answer:
      "Yes, from anywhere in the US. Choose Mail-In when you book, and we'll email you where to send them. You arrange the shipping yourself.",
  },
  {
    question: "What brands and materials do you work with?",
    answer:
      "Everyday pairs through designer and luxury brands, in leather, suede, canvas, and knit or mesh. Tell us about anything unusual in your booking notes.",
  },
  {
    question: "How do I get a quote for a custom request?",
    answer:
      "Send us a message with the topic “Custom request”, or book the closest service and add photos and notes. We review every pair and confirm the final price before any work begins.",
  },
];
