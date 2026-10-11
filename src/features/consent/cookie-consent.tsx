"use client";

import Script from "next/script";

// Silktide Consent Manager, pinned to v2.0.1 with SRI hashes (the CSP in
// next.config.mjs allows https://cdn.jsdelivr.net for exactly this).
const VERSION = "v2.0.1";
const BASE = `https://cdn.jsdelivr.net/gh/silktide/consent-manager@${VERSION}`;

declare global {
  interface Window {
    silktideConsentManager?: { init: (config: unknown) => void };
  }
}

const config = {
  backdrop: { show: false },
  icon: { position: "bottomRight" },
  prompt: { position: "bottomLeft" },
  consentTypes: [
    {
      id: "essential",
      label: "Essential",
      description:
        "<p>These cookies are necessary for the website to function properly and cannot be switched off. They help with things like logging in and setting your privacy preferences.</p>",
      required: true,
    },
    {
      id: "analytics",
      label: "Analytics",
      description:
        "<p>These cookies help us improve the site by tracking which pages are most popular and how visitors move around the site.</p>",
      required: false,
    },
    {
      id: "marketing",
      label: "Marketing",
      description:
        "<p>These cookies are used by us and our advertising partners to show you relevant ads on this site and elsewhere, and to measure how those campaigns perform.</p>",
      required: false,
      gtag: ["ad_storage", "ad_user_data", "ad_personalization"],
    },
  ],
  text: {
    prompt: {
      description:
        "<p>We use cookies on our site to enhance your user experience, provide personalized content, and analyze our traffic.</p>",
      acceptAllButtonText: "Accept all",
      acceptAllButtonAccessibleLabel: "Accept all cookies",
      rejectNonEssentialButtonText: "Reject non-essential",
      rejectNonEssentialButtonAccessibleLabel: "Reject all non-essential cookies",
      preferencesButtonText: "Preferences",
      preferencesButtonAccessibleLabel: "Toggle preferences",
    },
    preferences: {
      title: "Customize your cookie preferences",
      description:
        "<p>We respect your right to privacy. You can choose not to allow some types of cookies. Your cookie preferences will apply across our website.</p>",
      saveButtonText: "Save and close",
      saveButtonAccessibleLabel: "Save your cookie preferences",
      creditLinkText: "Get this banner for free",
      creditLinkAccessibleLabel: "Get this banner for free",
    },
  },
};

const theme = `
#stcm-wrapper {
  --boxShadow: -5px 5px 10px 0px #00000012, 0px 0px 50px 0px #0000001a;
  --fontFamily: Helvetica Neue, Segoe UI, Arial, sans-serif;
  --primaryColor: #533BE2;
  --backgroundColor: #FFFFFF;
  --textColor: #4B494B;
  --backdropBackgroundColor: #00000033;
  --backdropBackgroundBlur: 0px;
  --iconColor: #533BE2;
  --iconBackgroundColor: #FFFFFF;
}`;

export function CookieConsent() {
  return (
    <>
      <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href={`${BASE}/silktide-consent-manager.css`}
        integrity="sha384-EdMq+R+YOnsbelo08wPenoTlnxbAyxI11NMIxzugx/qAsbh64KcOkqxYqq6pfvO/"
        crossOrigin="anonymous"
      />
      <style>{theme}</style>
      <Script
        id="silktide-consent-manager"
        src={`${BASE}/silktide-consent-manager.js`}
        integrity="sha384-5Pt34uiIbCsvfiiZXoLi4HRf/YBXjr9c8e+gYeVo9smUaInNHYVtc8NZ8wUnXJIq"
        crossOrigin="anonymous"
        strategy="afterInteractive"
        onReady={() => window.silktideConsentManager?.init(config)}
      />
    </>
  );
}
