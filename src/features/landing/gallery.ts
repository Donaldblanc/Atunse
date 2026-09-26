// Landing-page gallery images. Each entry is a storage KEY, not a URL —
// resolved to an actual URL by getGalleryImageUrl below, the same
// adapter-style indirection as the FileStorage adapter (ADR-0004): callers
// never hardcode where an image is actually hosted.
//
// Today these keys resolve to /images/landing/<key> in this app's public/
// folder (placeholder photos, committed to the repo). Once the real photos
// are uploaded to S3, set NEXT_PUBLIC_ASSETS_BASE_URL (e.g. the bucket's
// public URL or a CloudFront domain in front of it) and every key below
// resolves there instead — no component changes needed, just upload the
// same key names (or update this list) and set the env var.
export interface GalleryImage {
  key: string;
  alt: string;
}

export const HERO_IMAGE: GalleryImage = {
  key: "hero-travis-scott-aj1-low.png",
  alt: "Restored Travis Scott Air Jordan 1 Low, before and after cleaning",
};

export const COMING_SOON_HERO_IMAGE: GalleryImage = {
  key: "coming-soon-hero.png",
  alt: "Sneaker restoration in progress",
};

// Services grid (4 cards) — one representative photo per category.
export const SERVICE_IMAGES: [GalleryImage, GalleryImage, GalleryImage, GalleryImage] = [
  { key: "cleaning.jpg", alt: "Sneaker cleaning" },
  { key: "restoration.jpg", alt: "Sneaker restoration" },
  { key: "protection.jpg", alt: "Sneaker protection" },
  { key: "custom-work.jpg", alt: "Custom sneaker work" },
];

export interface BeforeAfterImage {
  beforeKey: string;
  afterKey: string;
  caption: string;
  serviceLine: string;
}

// Before/After band — pixel-accurate before/after crops, one pair per
// restoration (see public/images/landing/README.txt for how these were cut).
// serviceLine promotes which service produced the result, with price, so
// the section informs pricing instead of just showing photos.
export const BEFORE_AFTER_IMAGES: BeforeAfterImage[] = [
  { beforeKey: "converse-weapon-before.jpg", afterKey: "converse-weapon-after.jpg", caption: "Converse Weapon", serviceLine: "Standard Clean · $30" },
  { beforeKey: "travis-scott-aj1-low-before.jpg", afterKey: "travis-scott-aj1-low-after.jpg", caption: "Travis Scott x Air Jordan 1 Low", serviceLine: "Premium Clean · $50" },
  { beforeKey: "jordan4-offwhite-before.jpg", afterKey: "jordan4-offwhite-after.jpg", caption: 'Air Jordan 4 "Off-White"', serviceLine: "Premium Clean · $50" },
  { beforeKey: "jordan11-concord-before.jpg", afterKey: "jordan11-concord-after.jpg", caption: 'Air Jordan 11 "Concord"', serviceLine: "Standard Clean · $30" },
  { beforeKey: "bottega-veneta-orbit-before.jpg", afterKey: "bottega-veneta-orbit-after.jpg", caption: "Bottega Veneta Orbit", serviceLine: "Premium Clean · $50" },
  { beforeKey: "jordan3-blackcement-before.jpg", afterKey: "jordan3-blackcement-after.jpg", caption: 'Air Jordan 3 "Black Cement"', serviceLine: "Oxidation Restoration · From $25+" },
];

export function getGalleryImageUrl(key: string): string {
  const base = process.env.NEXT_PUBLIC_ASSETS_BASE_URL;
  if (base) {
    return `${base.replace(/\/$/, "")}/${key}`;
  }
  return `/images/landing/${key}`;
}
