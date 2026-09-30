import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

/**
 * Integration tests delete every Order and customer Account in the database
 * they run against (delete-all-orders.ts), so they never use DATABASE_URL:
 * they need TEST_DATABASE_URL, and its database name must end in `_test`.
 * A dev, preview or production database can't be picked by mistake.
 */
export function testDatabaseUrl(env: Record<string, string | undefined>): string {
  const url = env.TEST_DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Integration tests delete data, so they only run " +
        "against a database of their own (docs/LOCAL_SETUP.md).",
    );
  }
  let name: string;
  try {
    name = decodeURIComponent(new URL(url).pathname.slice(1));
  } catch {
    throw new Error("TEST_DATABASE_URL is not a valid connection URL.");
  }
  if (!isTestDatabaseName(name)) {
    throw new Error(
      `TEST_DATABASE_URL points at the database "${name}". Its name must end in "_test", ` +
        "so integration tests can never delete real data.",
    );
  }
  return url;
}

export function isTestDatabaseName(name: string): boolean {
  return name.endsWith("_test");
}

/**
 * Overrides for every credential that reaches a live service, so no test can
 * upload to the real photo bucket or send a real email, whatever .env holds.
 */
export const OFFLINE_SERVICES_ENV: Record<string, string> = {
  STORAGE_DRIVER: "local",
  S3_BUCKET: "",
  S3_ENDPOINT: "",
  S3_REGION: "",
  S3_ACCESS_KEY_ID: "",
  S3_SECRET_ACCESS_KEY: "",
  AWS_ENDPOINT_URL_S3: "",
  AWS_ACCESS_KEY_ID: "",
  AWS_SECRET_ACCESS_KEY: "",
  RESEND_API_KEY: "",
  EMAIL_FROM: "",
};

/** `.env` merged under the real environment, which wins (as Prisma and Next do). */
export function loadEnv(cwd: string = process.cwd()): Record<string, string | undefined> {
  const file = path.join(cwd, ".env");
  const fromFile = existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : {};
  return { ...fromFile, ...process.env };
}
