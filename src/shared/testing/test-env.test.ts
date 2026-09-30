import { describe, expect, it } from "vitest";
import { isTestDatabaseName, testDatabaseUrl } from "./test-env";

describe("testDatabaseUrl", () => {
  it("returns a URL whose database name ends in _test", () => {
    const url = "postgresql://atunse:atunse@localhost:5432/atunse_test";
    expect(testDatabaseUrl({ TEST_DATABASE_URL: url })).toBe(url);
  });

  it("keeps query parameters", () => {
    const url = "postgresql://u:p@db.example.com/atunse_test?sslmode=require";
    expect(testDatabaseUrl({ TEST_DATABASE_URL: ` ${url} ` })).toBe(url);
  });

  it("refuses when TEST_DATABASE_URL is missing or blank, even if DATABASE_URL is set", () => {
    const dev = "postgresql://atunse:atunse@localhost:5432/atunse_dev";
    expect(() => testDatabaseUrl({ DATABASE_URL: dev })).toThrow(/TEST_DATABASE_URL is not set/);
    expect(() => testDatabaseUrl({ TEST_DATABASE_URL: "  " })).toThrow(/not set/);
  });

  it("refuses a database whose name doesn't end in _test", () => {
    for (const name of ["atunse_dev", "atunse-dev", "neondb", "atunse_test_copy", "test"]) {
      expect(() =>
        testDatabaseUrl({ TEST_DATABASE_URL: `postgresql://u:p@localhost:5432/${name}` }),
      ).toThrow(`"${name}"`);
    }
  });

  it("refuses a value that isn't a URL", () => {
    expect(() => testDatabaseUrl({ TEST_DATABASE_URL: "atunse_test" })).toThrow(/not a valid/);
  });
});

describe("isTestDatabaseName", () => {
  it("accepts only names ending in _test", () => {
    expect(isTestDatabaseName("atunse_test")).toBe(true);
    expect(isTestDatabaseName("atunse_dev")).toBe(false);
  });
});
