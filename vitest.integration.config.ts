import { defineConfig } from "vitest/config";
import path from "node:path";

// Repository/migration integration tests against a real Postgres (ADR-0012's
// build-strategy revision) — run via `npm run test:integration`, needs
// DATABASE_URL pointed at a real (local Docker or CI service-container) Postgres.
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
  },
});
