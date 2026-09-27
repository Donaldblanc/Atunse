// Deletes photos no Order references, older than 48 hours (#77): uploads
// (copied on submit, or from bookings never submitted) and copies from
// bookings that failed after copying.
//   STORAGE_CLEANUP_DATABASE_URL=<db for this bucket> npm run storage:cleanup            (dry run)
//   STORAGE_CLEANUP_DATABASE_URL=<db for this bucket> npm run storage:cleanup -- --apply
// The database must be named explicitly: it never falls back to .env's
// DATABASE_URL, which would pair e.g. the production bucket with the dev
// database and make every production photo look unreferenced.

import { loadEnvConfig } from "@next/env";
import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import {
  assertDatabaseMatchesBucket,
  ORPHAN_AFTER_HOURS,
  PHOTO_PREFIXES,
  selectOrphans,
  type StoredKey,
} from "../src/shared/storage/maintenance";
import { s3ConfigFromEnv } from "../src/shared/storage";
import { s3ClientFor } from "../src/shared/storage/s3-file-storage";

loadEnvConfig(process.cwd());

async function main() {
  const apply = process.argv.includes("--apply");
  const databaseUrl = process.env.STORAGE_CLEANUP_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Set STORAGE_CLEANUP_DATABASE_URL to the database that goes with this bucket (DATABASE_URL is never used here).");
  }
  const config = s3ConfigFromEnv();
  const client = s3ClientFor(config);
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  try {
    const objects: StoredKey[] = [];
    for (const prefix of PHOTO_PREFIXES) {
      let token: string | undefined;
      do {
        const page = await client.send(new ListObjectsV2Command({ Bucket: config.bucket, Prefix: prefix, ContinuationToken: token }));
        for (const o of page.Contents ?? []) if (o.Key && o.LastModified) objects.push({ key: o.Key, lastModified: o.LastModified });
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
    }

    const referenced = new Set((await prisma.itemPhoto.findMany({ select: { key: true } })).map((p) => p.key));
    const bucketKeys = new Set(objects.map((o) => o.key));
    const matched = [...referenced].filter((key) => bucketKeys.has(key)).length;
    const db = new URL(databaseUrl);
    console.log(`Bucket:   ${config.bucket} at ${config.endpoint ?? "AWS"} (${objects.length} photos)`);
    console.log(`Database: ${db.host}${db.pathname} (${referenced.size} photo keys, ${matched} of them in this bucket)`);

    const orphans = selectOrphans(objects, referenced, new Date());
    console.log(`${orphans.length} unreferenced and older than ${ORPHAN_AFTER_HOURS}h:`);
    for (const o of orphans) console.log(`  ${o.key}  (${o.lastModified.toISOString()})`);

    if (!apply) return console.log("\nDry run. Re-run with --apply to delete them.");
    assertDatabaseMatchesBucket(bucketKeys, referenced);
    for (const o of orphans) await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: o.key }));
    console.log(`\nDeleted ${orphans.length}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
