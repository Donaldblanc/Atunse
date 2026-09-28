// The owner's legal documents, served as PDFs from public/legal/ at stable
// URLs so links never change between versions. Each version is printed in
// the PDF itself: to publish a new one, replace the file under the same
// name and update `version` here to match.

export interface LegalDocument {
  title: string;
  href: string;
  version: string;
}

/** The contract the booking's Terms Agreement checkbox accepts (CONTEXT.md: Policy Acceptance). */
export const TERMS_AGREEMENT: LegalDocument = {
  title: "Terms of Service & Restoration Agreement",
  href: "/legal/terms-of-service-and-restoration-agreement.pdf",
  version: "2026-09-27-v1",
};

/** A notice about data practices, separate from the Terms (it says so itself). */
export const PRIVACY_POLICY: LegalDocument = {
  title: "Privacy Policy",
  href: "/legal/privacy-policy.pdf",
  version: "2026-09-27-v1",
};

export const LEGAL_DOCUMENTS = [TERMS_AGREEMENT, PRIVACY_POLICY] as const;
