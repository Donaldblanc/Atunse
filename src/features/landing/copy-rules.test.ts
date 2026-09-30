import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// CONTEXT.md: the Fulfillment Methods are Local Drop-Off (DJ collects the
// pair and drops it back off) and Mail-In. Customers never bring sneakers
// in, and Mail-In customers arrange their own shipping (ADR-0010, no
// labels). Customer-facing copy on the marketing pages and in the booking
// flow must never promise otherwise. Nor does the copy
// guarantee results, safety or timing: the Terms of Service & Restoration
// Agreement says results aren't guaranteed and turnaround times are
// estimates, and nothing on the site may contradict it. Code comments are
// skipped: they may name what doesn't exist.
const FORBIDDEN = [
  /\bdropped off a pair|drop (it|them|your pair) off at|bring (it|them|your pair) (in|to us)/i,
  /prepaid/i,
  /shipping label/i,
  /mail-in label/i,
  /walk[\s-]?in/i,
  /in[\s-]person/i,
  /\bstudio\b/i,
  // No guarantees.
  /guarantee/i,
  /warrant(y|ies)/i,
  /make it right/i,
  /no extra cost/i,
  /money[\s-]back/i,
  /satisfaction/i,
  /no surprises/i,
  /material[\s-]safe|\bsafe for\b/i,
  /like[\s-]new|good as new/i,
  /\bready in\b/i,
  /\d+[\s-]hour turnaround/i,
  /cuts .*turnaround/i,
];

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

  // "Pickup" is only a code name now (FulfillmentMethod "PICKUP", pickupDate…),
  // so this checks text customers read (string literals and JSX text, plus
  // server messages and emails in features/orders), not identifiers: a
  // phrase containing the word, or the bare label "Pickup".
  it("never says pickup to customers: it's Local Drop-Off", () => {
    const TEXT = /"([^"\\\n]*)"|'([^'\\\n]*)'|`([^`]*)`|>([^<>{}"'();=]+)</g; // JSX text never holds code punctuation
    const offenders = [...DIRS, "src/features/orders"].flatMap(sourceFiles).flatMap((file) =>
      [...withoutComments(readFileSync(file, "utf8")).matchAll(TEXT)]
        .map((m) => (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").trim())
        .filter((text) => /\bpick[\s-]?ups?\b/i.test(text) && (/\s/.test(text) || text === "Pickup"))
        .map((text) => `${path.relative(ROOT, file)}: ${text.slice(0, 80)}`),
    );
    expect(offenders).toEqual([]);
  });

  it.each(FORBIDDEN.map((pattern) => [String(pattern), pattern] as const))("never says %s", (_label, pattern) => {
    const offenders = files.filter((file) => pattern.test(withoutComments(readFileSync(file, "utf8"))));
    expect(offenders.map((file) => path.relative(ROOT, file))).toEqual([]);
  });
});
