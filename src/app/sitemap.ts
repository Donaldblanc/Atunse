import type { MetadataRoute } from "next";
import { PUBLIC_PATHS, siteUrl } from "@/shared/site/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PUBLIC_PATHS.map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    changeFrequency: path === "/" || path === "/services" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/booking" || path === "/services" ? 0.9 : 0.6,
  }));
}
