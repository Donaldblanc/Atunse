// The site's public origin, for robots.txt, the sitemap and canonical/Open
// Graph URLs. SITE_URL wins (set it once the custom domain exists);
// otherwise Vercel's production hostname; otherwise localhost for dev.

export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

/** Only the production deployment should be indexed: previews and dev answer "noindex". */
export function isIndexable(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === undefined ? env.NODE_ENV === "production" : env.VERCEL_ENV === "production";
}

/** The customer pages worth listing in the sitemap, most important first. */
export const PUBLIC_PATHS = ["/", "/services", "/booking", "/process", "/about", "/contact"] as const;
