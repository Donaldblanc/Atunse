import { defineConfig } from "vitest/config";
import path from "node:path";

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
  },
});
