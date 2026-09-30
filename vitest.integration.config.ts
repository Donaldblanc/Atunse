import { defineConfig } from "vitest/config";
import path from "node:path";
import { OFFLINE_SERVICES_ENV, loadEnv, testDatabaseUrl } from "./src/shared/testing/test-env";

// Repository/migration integration tests against a real Postgres (ADR-0012's
// build-strategy revision) — run via `npm run test:integration`. They delete
// data, so they run only against TEST_DATABASE_URL (a database named *_test),
// never DATABASE_URL: this throws before any test runs if it isn't one.
const databaseUrl = testDatabaseUrl(loadEnv());

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["**/*.integration.test.ts"],
    exclude: ["**/node_modules/**", "demo_mock/**"],
    testTimeout: 20_000,
    env: { ...OFFLINE_SERVICES_ENV, DATABASE_URL: databaseUrl },
    globalSetup: ["./src/shared/testing/migrate-test-database.ts"],
    // Every integration file resets the same tables in beforeEach, so files
    // must not run concurrently against the shared database.
    fileParallelism: false,
    // See vitest.config.ts — the scaffold PR has no integration tests yet
    // either (they land in [2/4]).
    passWithNoTests: true,
  },
});
