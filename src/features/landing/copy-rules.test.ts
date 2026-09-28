import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// CONTEXT.md: Fulfillment Method is Pickup or Mail-In only: customers never
// bring sneakers in, and Mail-In customers arrange their own shipping
// (ADR-0010, no labels). Customer-facing copy on the marketing pages and in
// the booking flow must never promise otherwise. Code comments are
// skipped: they may name what doesn't exist.
const FORBIDDEN = [/drop(ped)?[\s-]?off/i, /prepaid/i, /shipping label/i, /mail-in label/i, /walk[\s-]?in/i, /in[\s-]person/i, /\bstudio\b/i];

const ROOT = process.cwd();
const DIRS = ["src/app", "src/features/landing", "src/features/booking", "src/features/contact"];

function sourceFiles(dir: string): string[] {
  if (!existsSync(path.join(ROOT, dir))) return []; // e.g. a feature not on this branch yet
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.(tsx?|ts)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

/** The file without its // and /* *\/ comments (JSX {/* *\/} comments included). */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

describe("customer-facing copy", () => {
  const files = DIRS.flatMap(sourceFiles);

  it("finds the pages to check", () => {
    expect(files.some((f) => f.endsWith(path.join("src", "app", "page.tsx")))).toBe(true);
  });

  it.each(FORBIDDEN.map((pattern) => [String(pattern), pattern] as const))("never says %s", (_label, pattern) => {
    const offenders = files.filter((file) => pattern.test(withoutComments(readFileSync(file, "utf8"))));
    expect(offenders.map((file) => path.relative(ROOT, file))).toEqual([]);
  });
});
