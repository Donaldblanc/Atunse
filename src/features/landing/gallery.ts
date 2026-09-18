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
  key: "hero.jpg",
  alt: "Restored Travis Scott Air Jordan 1 Low, before and after cleaning",
};

export const GALLERY_IMAGES: GalleryImage[] = [
  { key: "gallery-01.jpg", alt: "Restored sneaker, before and after" },
  { key: "gallery-02.jpg", alt: "Restored sneaker, before and after" },
  { key: "gallery-03.jpg", alt: "Restored sneaker, before and after" },
  { key: "gallery-04.jpg", alt: "Restored sneaker, before and after" },
  { key: "gallery-05.jpg", alt: "Restored sneaker, before and after" },
  { key: "gallery-06.jpg", alt: "Restored sneaker, before and after" },
  { key: "gallery-07.jpg", alt: "Restored sneaker, before and after" },
  { key: "gallery-08.jpg", alt: "Restored sneaker, before and after" },
];

export function getGalleryImageUrl(key: string): string {
  const base = process.env.NEXT_PUBLIC_ASSETS_BASE_URL;
  if (base) {
    return `${base.replace(/\/$/, "")}/${key}`;
  }
  return `/images/landing/${key}`;
}
