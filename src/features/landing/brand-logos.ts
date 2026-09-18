// "Trusted by" trust-bar logo marquee. Same key/URL-resolution shape as
// gallery.ts (ADR-0004-style adapter indirection) — resolves to
// public/images/brand-logos/<slug>_<variant>.png today; swap to
// NEXT_PUBLIC_ASSETS_BASE_URL once these are hosted elsewhere.
export interface BrandLogo {
  slug: string;
  name: string;
}

export const BRAND_LOGOS: BrandLogo[] = [
  { slug: "nike", name: "Nike" },
  { slug: "jordan", name: "Jordan" },
  { slug: "new_balance", name: "New Balance" },
  { slug: "adidas", name: "Adidas" },
  { slug: "gucci", name: "Gucci" },
  { slug: "prada", name: "Prada" },
  { slug: "dior", name: "Dior" },
  { slug: "fendi", name: "Fendi" },
  { slug: "balenciaga", name: "Balenciaga" },
  { slug: "alexander_mcqueen", name: "Alexander McQueen" },
  { slug: "lv", name: "Louis Vuitton" },
];

export function getBrandLogoUrl(slug: string, variant: "black" | "white"): string {
  const base = process.env.NEXT_PUBLIC_ASSETS_BASE_URL;
  const filename = `${slug}_${variant}.png`;
  if (base) {
    return `${base.replace(/\/$/, "")}/brand-logos/${filename}`;
  }
  return `/images/brand-logos/${filename}`;
}
