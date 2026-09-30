ATUNSE — LEGAL DOCUMENTS (ADR-0015)

terms/<version>.pdf     Terms of Service & Restoration Agreement
privacy/<version>.pdf   Privacy Policy

Every booking records the Terms version it accepted, this file's URL and
its SHA-256. So:
- NEVER overwrite, rename or delete a published version: past bookings
  point at it.
- To publish a new version, add a new file (e.g. terms/2027-01-15-v2.pdf),
  then update src/shared/legal-documents.ts (version, href, sha256).
  src/shared/legal-documents.test.ts checks the hash against the file.
