import type { Metadata } from "next";

// One place for a customer page's <head>: its own title and description,
// a canonical URL, and matching Open Graph / Twitter tags so a shared link
// shows the page's name rather than the site-wide default. URLs are
// relative: the root layout's metadataBase (siteUrl()) makes them absolute.

export const SITE_NAME = "Atunṣe";
export const OG_IMAGE = { url: "/images/og-default.jpg", width: 1200, height: 630, alt: "A restored sneaker, before and after cleaning" };

export function pageMetadata(page: { title: string; description: string; path: string }): Metadata {
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: page.path },
    openGraph: {
      title: page.title,
      description: page.description,
      url: page.path,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title: page.title, description: page.description, images: [OG_IMAGE.url] },
  };
}
