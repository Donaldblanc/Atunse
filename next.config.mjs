// Security headers for every response (vulnerability scan, #87 follow-up).
// The Content-Security-Policy ships as Report-Only first: browsers log what
// it would block without blocking anything, so it can't break the site.
// Rollout (docs/TODO.md): Report-Only -> observe violations -> tighten
// sources -> nonce/hash-based scripts -> enforce.

const isDev = process.env.NODE_ENV === "development";

/**
 * A configured URL's origin, validated: https only (or http://localhost),
 * no credentials, no wildcards. Anything else is ignored rather than
 * interpolated into the policy, so a malformed env var can't widen it.
 */
function validatedOrigin(value) {
  if (!value) return null;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const localhost = url.protocol === "http:" && url.hostname === "localhost";
  if ((url.protocol !== "https:" && !localhost) || url.username || url.password || url.hostname.includes("*")) return null;
  return url.origin;
}

/**
 * Where the browser POSTs booking photos (presigned POST, ADR-0004), or
 * null when it doesn't upload anywhere but this site. Mirrors
 * getFileStorage/s3ConfigFromEnv in src/shared/storage: the local driver
 * (the default outside production) uploads same-origin; S3-compatible
 * storage uses its endpoint; plain AWS uses the bucket's own host. Never a
 * wildcard.
 */
function uploadOrigin(env) {
  const driver = env.STORAGE_DRIVER?.trim() || (env.NODE_ENV === "production" ? "s3" : "local");
  if (driver !== "s3") return null;
  const endpoint = validatedOrigin(env.S3_ENDPOINT) ?? validatedOrigin(env.AWS_ENDPOINT_URL_S3);
  if (endpoint) return endpoint;
  const bucket = env.S3_BUCKET?.trim();
  const region = (env.S3_REGION || env.AWS_REGION)?.trim();
  if (!bucket || !region || !/^[a-z0-9.-]+$/.test(bucket) || !/^[a-z0-9-]+$/.test(region)) return null;
  return `https://${bucket}.s3.${region}.amazonaws.com`;
}

const storageOrigin = uploadOrigin(process.env);
// Marketing images, when hosted off-site (features/landing).
const assetsOrigin = validatedOrigin(process.env.NEXT_PUBLIC_ASSETS_BASE_URL);

const contentSecurityPolicy = [
  "default-src 'self'",
  // TRANSITIONAL DEBT: 'unsafe-inline' is only here because Next's inline
  // bootstrap scripts carry no nonce yet. The target state is nonce- (or
  // hash-) based scripts with no 'unsafe-inline'; see docs/TODO.md for the
  // rollout. Dev mode also evaluates code for hot reloading.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  // blob: for the photo thumbnails picked in the booking form. Add the
  // storage origin here once a page displays stored photos (view links).
  ["img-src 'self' data: blob:", assetsOrigin].filter(Boolean).join(" "),
  // The storage origin only when the browser uploads to it directly.
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
