import { execFileSync } from "node:child_process";
import { loadEnv, testDatabaseUrl } from "./test-env";

/**
 * Vitest globalSetup for integration tests: brings the test database up to
 * the latest migration before any file runs, so it never lags the schema.
 */
export default function migrateTestDatabase(): void {
  const databaseUrl = testDatabaseUrl(loadEnv());
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: ["ignore", "ignore", "inherit"],
  });
}
