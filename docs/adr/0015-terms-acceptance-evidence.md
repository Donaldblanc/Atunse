# 0015. Record each booking's terms acceptance as evidence

## Status
Accepted (2026-09-28). Refines Policy Acceptance in `CONTEXT.md`.

## Context
Every booking accepts the owner's **Terms of Service & Restoration Agreement** (a PDF) after ticking four risk acknowledgments. New York treats an electronic signature as an electronic process that is associated with an electronic record and adopted with an intent to sign. The state's guidance stresses three things:
- affirmative acceptance;
- recording the date, time and fact of acceptance;
- keeping the acceptance tied to the exact record that was accepted.

Before this, an Order only stored `policyAcceptedAt`. Once the agreement changed, nothing would show which version a customer had agreed to.

## Decision
- **Affirmative, never pre-checked.** The Review step starts with every box unticked. Confirm Booking stays disabled until the customer ticks all four acknowledgments and the Terms Agreement. `submitOrder` enforces the same rule on the server.
- **One permanent URL per version.** Each version of a legal PDF lives at `/legal/<document>/<version>.pdf` (e.g. `/legal/terms/2026-09-27-v1.pdf`). Versions are never overwritten or deleted. `src/shared/legal-documents.ts` names the current version, its URL and the **SHA-256 of its bytes**. A test fails if that hash doesn't match the file actually served.
- **The customer accepts the version they saw.** The booking page sends the agreement version it displayed (`termsVersion`). `submitOrder` refuses a booking whose version isn't the current one, with the message "reload the page". The server therefore never records acceptance of an agreement the customer wasn't shown.
- **Every Order stores the evidence** alongside `policyAcceptedAt`, which is the server's date and time of acceptance:
  - `termsVersion`;
  - `termsUrl`;
  - `termsSha256`;
  - `termsAcknowledgments`: each acknowledgment id → ticked, i.e. `{ pricing, restorationResults, materialRisks, structuralLimitations }`.

  The domain reads these as `Order.termsAcceptance`. The columns are nullable only because Orders from before the agreement existed have none. Every new Order has all four.
- **The customer gets a copy.** The confirmation email states which agreement version they accepted.
- The Privacy Policy follows the same versioned-URL scheme. It's a notice, not accepted per booking, so it isn't recorded on the Order.

## Consequences
- **Publishing a new agreement version:**
  - add the new PDF beside the old one;
  - update `version`, `href` and `sha256`;
  - deploy.

  Tabs still showing the old version are asked to reload before they can book.
- **Old PDFs must stay deployed forever,** or the URLs stored on past Orders stop working. `public/legal/README.txt` says so.
- **Not recorded yet:** the customer's IP address and user agent. These could be added later as further evidence, subject to the Privacy Policy.
