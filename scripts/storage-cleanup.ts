// Deletes booking photos no Order references, older than 48 hours (#77):
// uploads from bookings that were never submitted.
//   npm run storage:cleanup            (dry run: lists what would go)
//   npm run storage:cleanup -- --apply (deletes them)
// Point DATABASE_URL at the database that goes with this bucket.

import { loadEnvConfig } from "@next/env";
import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import { selectOrphans, ORPHAN_AFTER_HOURS, type StoredKey } from "../src/shared/storage/maintenance";
import { s3ConfigFromEnv } from "../src/shared/storage";
import { s3ClientFor } from "../src/shared/storage/s3-file-storage";

loadEnvConfig(process.cwd());

async function main() {
  const apply = process.argv.includes("--apply");
  const config = s3ConfigFromEnv();
  const client = s3ClientFor(config);
  const prisma = new PrismaClient();

  try {
    const objects: StoredKey[] = [];
    let token: string | undefined;
    do {
      const page = await client.send(
        new ListObjectsV2Command({ Bucket: config.bucket, Prefix: "bookings/", ContinuationToken: token }),
      );
      for (const o of page.Contents ?? []) if (o.Key && o.LastModified) objects.push({ key: o.Key, lastModified: o.LastModified });
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);

    const referenced = new Set((await prisma.itemPhoto.findMany({ select: { key: true } })).map((p) => p.key));
    const orphans = selectOrphans(objects, referenced, new Date());
    console.log(`Bucket ${config.bucket}: ${objects.length} booking photos, ${referenced.size} attached to orders.`);
    console.log(`${orphans.length} unattached and older than ${ORPHAN_AFTER_HOURS}h:`);
    for (const o of orphans) console.log(`  ${o.key}  (${o.lastModified.toISOString()})`);

    if (!apply) return console.log("\nDry run. Re-run with --apply to delete them.");
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
