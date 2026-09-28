import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LEGAL_DOCUMENTS } from "./legal-documents";

describe("legal documents", () => {
  it.each(LEGAL_DOCUMENTS.map((doc) => [doc.title, doc] as const))("%s ships as the exact PDF its hash names", (title, doc) => {
    // One permanent URL per version, never reused for another version.
    expect(doc.href).toBe(`/legal/${doc.href.split("/")[2]}/${doc.version}.pdf`);
    const pdf = readFileSync(path.join(process.cwd(), "public", doc.href));
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.toString("latin1")).toContain(`/Title (Atunse ${title})`);
    // The hash a booking records is the hash of the file actually served.
    expect(createHash("sha256").update(pdf).digest("hex")).toBe(doc.sha256);
  });
});
