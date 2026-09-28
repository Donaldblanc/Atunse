-- ADR-0015: the evidence of what each booking's customer accepted. With
-- policyAcceptedAt (the date and time), these say exactly which Terms of
-- Service & Restoration Agreement it was (version, permanent URL, SHA-256
-- of the PDF) and which risk acknowledgments were ticked. Null for Orders
-- from before the agreement existed.
ALTER TABLE "orders" ADD COLUMN "termsVersion" TEXT;
ALTER TABLE "orders" ADD COLUMN "termsUrl" TEXT;
ALTER TABLE "orders" ADD COLUMN "termsSha256" TEXT;
ALTER TABLE "orders" ADD COLUMN "termsAcknowledgments" JSONB;
