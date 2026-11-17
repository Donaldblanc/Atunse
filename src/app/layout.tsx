import type { Metadata } from "next";
import { CookieConsent } from "@/features/consent/cookie-consent";
import { OG_IMAGE, SITE_NAME } from "@/shared/site/page-metadata";
import { isIndexable, siteUrl } from "@/shared/site/site-url";

// Site-wide defaults; each customer page sets its own through pageMetadata().
// Only the production deployment is indexable (previews and dev say noindex).
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: SITE_NAME,
  description: "Sneaker cleaning and restoration — RestoredByDJ",
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en_US", images: [OG_IMAGE] },
  twitter: { card: "summary_large_image" },
  robots: isIndexable() ? undefined : { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
