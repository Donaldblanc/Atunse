// The owner's legal documents, served as PDFs from public/legal/. Every
// version gets its own permanent URL (/legal/<document>/<version>.pdf)
// and is never overwritten or deleted, so the URL and SHA-256 a booking
// recorded keep pointing at exactly what the customer accepted (ADR-0015).
// To publish a new version: add the new file beside the old one, then
// update `version`, `href` and `sha256` here (legal-documents.test.ts
// checks the hash against the file).

export interface LegalDocument {
  title: string;
  version: string;
  href: string;
  /** SHA-256 of the PDF's bytes, hex. */
  sha256: string;
}

/** The contract the booking's Terms Agreement checkbox accepts (CONTEXT.md: Policy Acceptance). */
export const TERMS_AGREEMENT: LegalDocument = {
  title: "Terms of Service & Restoration Agreement",
  version: "2026-09-27-v1",
  href: "/legal/terms/2026-09-27-v1.pdf",
  sha256: "65c9ad00d15279d81fb433299e235176281ea12efd8d141826066b1528395874",
};

/** A notice about data practices, separate from the Terms (it says so itself). Not accepted per booking. */
export const PRIVACY_POLICY: LegalDocument = {
  title: "Privacy Policy",
  version: "2026-09-27-v1",
  href: "/legal/privacy/2026-09-27-v1.pdf",
  sha256: "a1c04ceab749e559b33613c61fee38372442f5ea3e7cf219fb65c9d6cd63fd0c",
};

export const LEGAL_DOCUMENTS = [TERMS_AGREEMENT, PRIVACY_POLICY] as const;
