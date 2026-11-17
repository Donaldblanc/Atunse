import type { MetadataRoute } from "next";
import { isIndexable, siteUrl } from "@/shared/site/site-url";

// Production lets crawlers read the customer pages and keeps them out of
// the admin, the API and the placeholders; every other deployment
// (previews, dev) asks not to be crawled at all.
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/sign-in", "/coming-soon"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
