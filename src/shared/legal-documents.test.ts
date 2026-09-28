import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LEGAL_DOCUMENTS } from "./legal-documents";

describe("legal documents", () => {
  it.each(LEGAL_DOCUMENTS.map((doc) => [doc.title, doc] as const))("%s is a same-site PDF that ships with the app", (title, doc) => {
    expect(doc.href).toMatch(/^\/legal\/[a-z-]+\.pdf$/);
    const pdf = readFileSync(path.join(process.cwd(), "public", doc.href));
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // The document itself (its title metadata), not some other PDF.
    expect(pdf.toString("latin1")).toContain(`/Title (Atunse ${title})`);
  });
});
