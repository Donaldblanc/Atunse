// Bucket settings and housekeeping the app itself doesn't do (#77), run by
// hand through `npm run storage:configure` / `npm run storage:cleanup`
// (scripts/). The rules are pure functions here, so they're tested; the
// scripts only fetch, print and apply.

import type { CORSRule } from "@aws-sdk/client-s3";

/**
 * Browsers upload photos straight to the bucket with a presigned POST, so
 * the bucket must allow POST from the site. Nothing else: photo view links
 * load in <img> tags, which don't need CORS, and nothing in the browser
 * ever PUTs or DELETEs.
 */
export function corsRulesFor(origins: string[]): CORSRule[] {
  const cleaned = [...new Set(origins.map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean))];
  if (cleaned.length === 0) throw new Error("Give at least one origin, e.g. https://atunse.com");
  for (const origin of cleaned) {
    const ok = /^https:\/\/[a-z0-9.*-]+(:\d+)?$/i.test(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
    if (!ok) throw new Error(`Not an allowed origin: ${origin} (use https://…, or http://localhost:<port>)`);
  }
  return [{ AllowedOrigins: cleaned, AllowedMethods: ["POST"], AllowedHeaders: ["*"], ExposeHeaders: ["ETag"], MaxAgeSeconds: 3000 }];
}

export interface StoredKey {
  key: string;
  lastModified: Date;
}

/** Uploads get this long to be attached to a booking before they're orphans. */
export const ORPHAN_AFTER_HOURS = 48;

/**
 * Booking photos no Order references, old enough that no booking in
 * progress could still claim them. A bucket lifecycle rule can't make this
 * call (it can't tell attached photos from abandoned ones, which share the
 * bookings/ prefix), so it's checked against the database instead.
 */
export function selectOrphans(objects: StoredKey[], referencedKeys: Set<string>, now: Date, olderThanHours = ORPHAN_AFTER_HOURS): StoredKey[] {
  const cutoff = now.getTime() - olderThanHours * 60 * 60 * 1000;
  return objects.filter(
    (object) => object.key.startsWith("bookings/") && !referencedKeys.has(object.key) && object.lastModified.getTime() < cutoff,
  );
}
