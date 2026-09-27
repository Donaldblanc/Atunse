// Sets the photo bucket's CORS to the site's origins and POST only (#77).
//   STORAGE_ALLOWED_ORIGINS=https://atunse.com,https://*.vercel.app npm run storage:configure
// Dry run by default: prints the current and proposed rules. Add --apply to write them.

import { loadEnvConfig } from "@next/env";
import { GetBucketCorsCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { corsRulesFor } from "../src/shared/storage/maintenance";
import { s3ConfigFromEnv } from "../src/shared/storage";
import { s3ClientFor } from "../src/shared/storage/s3-file-storage";

loadEnvConfig(process.cwd());

async function main() {
  const apply = process.argv.includes("--apply");
  const origins = (process.env.STORAGE_ALLOWED_ORIGINS ?? "").split(",");
  const rules = corsRulesFor(origins);
  const config = s3ConfigFromEnv();
  const client = s3ClientFor(config);

  const current = await client
    .send(new GetBucketCorsCommand({ Bucket: config.bucket }))
    .then((r) => r.CORSRules ?? [])
    .catch((err) => (err.name === "NoSuchCORSConfiguration" ? [] : Promise.reject(err)));
  console.log(`Bucket: ${config.bucket}`);
  console.log("Current CORS:", JSON.stringify(current, null, 2));
  console.log("Proposed CORS:", JSON.stringify(rules, null, 2));

  if (!apply) return console.log("\nDry run. Re-run with --apply to write the proposed rules.");
  await client.send(new PutBucketCorsCommand({ Bucket: config.bucket, CORSConfiguration: { CORSRules: rules } }));
  const after = await client.send(new GetBucketCorsCommand({ Bucket: config.bucket }));
  console.log("\nApplied. Bucket now has:", JSON.stringify(after.CORSRules, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
