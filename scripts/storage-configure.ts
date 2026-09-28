// Sets the photo bucket's CORS to the site's origins and POST only (#77).
//   STORAGE_ALLOWED_ORIGINS=https://atunse.com,https://*.vercel.app npm run storage:configure
// Dry run by default: prints the current and proposed rules. Add --apply to write them.
// Every --apply first saves the bucket's current rules to
// .storage-backups/cors-<bucket>-<time>.json. To put a saved set back:
//   npm run storage:configure -- --restore <backup.json>            (dry run)
//   npm run storage:configure -- --restore <backup.json> --apply
// See docs/DEPLOYMENT.md ("Reverting the bucket's CORS").

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DeleteBucketCorsCommand, GetBucketCorsCommand, PutBucketCorsCommand, type CORSRule, type S3Client } from "@aws-sdk/client-s3";
import { corsRulesFor, parseCorsBackup, type CorsBackup } from "../src/shared/storage/maintenance";
import { s3ConfigFromEnv } from "../src/shared/storage";
import { s3ClientFor } from "../src/shared/storage/s3-file-storage";

loadEnvConfig(process.cwd());

const BACKUP_DIR = ".storage-backups";

async function currentRules(client: S3Client, bucket: string): Promise<CORSRule[]> {
  return client
    .send(new GetBucketCorsCommand({ Bucket: bucket }))
    .then((r) => r.CORSRules ?? [])
    .catch((err) => (err.name === "NoSuchCORSConfiguration" ? [] : Promise.reject(err)));
}

function saveBackup(bucket: string, rules: CORSRule[]): string {
  const savedAt = new Date().toISOString();
  const backup: CorsBackup = { bucket, savedAt, rules };
  mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `cors-${bucket}-${savedAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, `${JSON.stringify(backup, null, 2)}\n`);
  return file;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const restoreAt = process.argv.indexOf("--restore");
  const restoreFile = restoreAt === -1 ? null : process.argv[restoreAt + 1];
  if (restoreAt !== -1 && !restoreFile) throw new Error("--restore needs a backup file");

  const config = s3ConfigFromEnv();
  const client = s3ClientFor(config);
  const rules = restoreFile
    ? parseCorsBackup(JSON.parse(readFileSync(restoreFile, "utf8")), config.bucket)
    : corsRulesFor((process.env.STORAGE_ALLOWED_ORIGINS ?? "").split(","));

  const current = await currentRules(client, config.bucket);
  console.log(`Bucket: ${config.bucket}`);
  console.log("Current CORS:", JSON.stringify(current, null, 2));
  console.log(`${restoreFile ? `Restoring from ${restoreFile}` : "Proposed CORS"}:`, JSON.stringify(rules, null, 2));

  if (!apply) return console.log("\nDry run. Re-run with --apply to write these rules.");
  console.log(`\nSaved the current rules to ${saveBackup(config.bucket, current)} (restore with --restore <that file> --apply).`);
  if (rules.length === 0) {
    // The backup recorded no CORS configuration at all.
    await client.send(new DeleteBucketCorsCommand({ Bucket: config.bucket }));
  } else {
    await client.send(new PutBucketCorsCommand({ Bucket: config.bucket, CORSConfiguration: { CORSRules: rules } }));
  }
  console.log("Applied. Bucket now has:", JSON.stringify(await currentRules(client, config.bucket), null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
