import { defineConfig } from "vitest/config";
import path from "node:path";
import { OFFLINE_SERVICES_ENV } from "./src/shared/testing/test-env";

// Unit tests only — no real Postgres, no network. Excludes *.integration.test.ts
// (see vitest.integration.config.ts) so `npm test` stays fast (ADR-0013).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    exclude: ["**/node_modules/**", "**/*.integration.test.ts", "demo_mock/**"],
    // A unit test that reaches a database or a live service by mistake fails
    // (nothing listens on port 1) instead of touching the data .env points at.
    env: {
      ...OFFLINE_SERVICES_ENV,
      DATABASE_URL: "postgresql://unit-tests@127.0.0.1:1/unit_tests_have_no_database",
    },
    // The scaffold PR has no test files yet (they land in [2/4]); vitest
    // treats an empty run as a failure by default, which would fail CI on
    // this branch alone. Every later branch has real tests, so this has no
    // effect once [2/4] merges.
    passWithNoTests: true,
  },
});
