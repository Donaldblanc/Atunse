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
    // A wildcard only as a single leading label, before a real domain:
    // https://*.vercel.app passes; https://*, https://*.* and https://*.com don't.
    const ok = /^https:\/\/(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?$/i.test(origin) && !/^https:\/\/\*\.[a-z0-9-]+(:\d+)?$/i.test(origin);
    const localhost = /^http:\/\/localhost(:\d+)?$/.test(origin);
    if (!ok && !localhost) throw new Error(`Not an allowed origin: ${origin} (use https://…, or http://localhost:<port>)`);
  }
  return [{ AllowedOrigins: cleaned, AllowedMethods: ["POST"], AllowedHeaders: ["*"], ExposeHeaders: ["ETag"], MaxAgeSeconds: 3000 }];
}

/** A saved copy of a bucket's CORS rules: what `storage:configure --apply` writes before changing them. */
export interface CorsBackup {
  bucket: string;
  savedAt: string;
  rules: CORSRule[];
}

/**
 * A backup file's contents, checked before `storage:configure --restore`
 * puts them back: the right bucket, and rules that are well-formed (each
 * with origins and methods). An empty list is valid: the bucket had no
 * CORS configuration.
 */
export function parseCorsBackup(json: unknown, bucket: string): CORSRule[] {
  const backup = json as Partial<CorsBackup> | null;
  if (!backup || typeof backup !== "object" || !Array.isArray(backup.rules)) {
    throw new Error("Not a CORS backup: expected { bucket, savedAt, rules: [...] }");
  }
  if (backup.bucket !== bucket) {
    throw new Error(`This backup is for bucket "${backup.bucket}", not "${bucket}". Refusing to restore it.`);
  }
  for (const rule of backup.rules) {
    const valid =
      Array.isArray(rule?.AllowedOrigins) &&
      rule.AllowedOrigins.length > 0 &&
      Array.isArray(rule?.AllowedMethods) &&
      rule.AllowedMethods.length > 0;
    if (!valid) throw new Error("Every rule in the backup needs AllowedOrigins and AllowedMethods.");
  }
  return backup.rules;
}

/**
 * Refuses a cleanup whose database doesn't belong with the bucket (#77):
 * if the bucket has photos but none of the database's photos are among
 * them, the pair is almost certainly wrong (e.g. production bucket, dev
 * database), and "unreferenced" would mean every photo.
 */
export function assertDatabaseMatchesBucket(bucketKeys: Set<string>, referencedKeys: Set<string>): void {
  const matched = [...referencedKeys].filter((key) => bucketKeys.has(key)).length;
  if (bucketKeys.size > 0 && matched === 0) {
    throw new Error(
      `None of this database's ${referencedKeys.size} photos are in the bucket (wrong database?). Refusing to delete anything.`,
    );
  }
}

export interface StoredKey {
  key: string;
  lastModified: Date;
}

/** Uploads get this long to be attached to a booking before they're orphans. */
export const ORPHAN_AFTER_HOURS = 48;

/**
 * Where booking photos live: `bookings/` holds uploads (throwaway once a
 * booking copies them), `photos/` holds the verified copies Orders keep.
 */
export const PHOTO_PREFIXES = ["bookings/", "photos/"] as const;

/**
 * Photos no Order references, old enough that no booking in progress could
 * still claim them: uploads that were copied on submit or never submitted,
 * and copies from bookings that failed afterwards. A bucket lifecycle rule
 * can't make this call (it can't tell an Order's photo from an abandoned
 * one), so it's checked against the database instead.
 */
export function selectOrphans(objects: StoredKey[], referencedKeys: Set<string>, now: Date, olderThanHours = ORPHAN_AFTER_HOURS): StoredKey[] {
  const cutoff = now.getTime() - olderThanHours * 60 * 60 * 1000;
  return objects.filter(
    (object) =>
      PHOTO_PREFIXES.some((prefix) => object.key.startsWith(prefix)) &&
      !referencedKeys.has(object.key) &&
      object.lastModified.getTime() < cutoff,
  );
}
