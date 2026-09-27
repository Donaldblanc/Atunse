// Security headers for every response (vulnerability scan, #87 follow-up).
// The Content-Security-Policy ships as Report-Only first: browsers log what
// it would block without blocking anything, so it can't break the site.
// Switch it to enforcing once a preview shows no violations (docs/TODO.md).

const isDev = process.env.NODE_ENV === "development";

/** An env var's URL origin, or null when unset or not a URL. */
function originOf(value) {
  try {
    return value ? new URL(value).origin : null;
  } catch {
    return null;
  }
}

// The browser POSTs booking photos straight to storage (presigned POST,
// ADR-0004), and marketing images may come from an assets host. Same
// env vars the app reads (src/shared/storage, features/landing).
const storageOrigin =
  originOf(process.env.S3_ENDPOINT) ?? originOf(process.env.AWS_ENDPOINT_URL_S3) ?? "https://*.amazonaws.com";
const assetsOrigin = originOf(process.env.NEXT_PUBLIC_ASSETS_BASE_URL);

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next's inline bootstrap needs 'unsafe-inline' without nonces (a later
  // step); dev mode also evaluates code for hot reloading.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  // blob: for the photo thumbnails picked in the booking form.
  ["img-src 'self' data: blob:", storageOrigin, assetsOrigin].filter(Boolean).join(" "),
  ["connect-src 'self'", storageOrigin, isDev ? "ws:" : null].filter(Boolean).join(" "),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
