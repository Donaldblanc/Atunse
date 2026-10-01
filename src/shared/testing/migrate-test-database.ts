import { execFileSync } from "node:child_process";
import type { TestProject } from "vitest/node";
import { loadEnv, testDatabaseUrl } from "./test-env";

/**
 * Vitest globalSetup for integration tests: brings the test database up to
 * the latest migration before any file runs, so it never lags the schema.
 */
export default function migrateTestDatabase(project: TestProject): void {
  const databaseUrl = testDatabaseUrl(loadEnv(project.config.root));
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: project.config.root,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    // stdout lists the migrations applied, so CI logs show what ran.
    stdio: ["ignore", "inherit", "inherit"],
  });
}
