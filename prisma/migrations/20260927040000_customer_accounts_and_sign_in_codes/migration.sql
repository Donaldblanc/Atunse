-- ADR-0014: every Order belongs to an Account (Customer Accounts are created
-- by the first booking), and customers sign in with emailed codes.

-- Contact details stay on the Order as a per-booking snapshot, renamed now
-- that there are no guest orders. Renamed, not dropped: keeps the data.
ALTER TABLE "orders" RENAME COLUMN "guestEmail" TO "contactEmail";
ALTER TABLE "orders" RENAME COLUMN "guestPhone" TO "contactPhone";

-- Admin and Customer Accounts are separate identities (ADR-0014): the same
-- email can have one of each. Must happen before the backfill, so an old
-- order placed with the admin's email gets its own Customer Account.
DROP INDEX "accounts_email_key";
CREATE UNIQUE INDEX "accounts_email_role_key" ON "accounts"("email", "role");

-- Give each existing account-less order a Customer Account, one per
-- (lowercased) email; an email that already has a Customer Account reuses
-- it. Orders never attach to an Admin Account.
INSERT INTO "accounts" ("id", "role", "email", "phone", "createdAt")
SELECT
  gen_random_uuid()::text,
  'CUSTOMER',
  lower(o."contactEmail"),
  (array_agg(o."contactPhone" ORDER BY o."createdAt") FILTER (WHERE o."contactPhone" IS NOT NULL))[1],
  min(o."createdAt")
FROM "orders" o
WHERE o."accountId" IS NULL AND o."contactEmail" IS NOT NULL
GROUP BY lower(o."contactEmail")
ON CONFLICT ("email", "role") DO NOTHING;

UPDATE "orders" o
SET "accountId" = a."id"
FROM "accounts" a
WHERE o."accountId" IS NULL AND a."email" = lower(o."contactEmail") AND a."role" = 'CUSTOMER';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "orders" WHERE "accountId" IS NULL) THEN
    RAISE EXCEPTION 'orders without an email cannot be given an Account; fix them before migrating';
  END IF;
END $$;

-- Pre-booking-flow smoke-test orders could have no phone. Every booking
-- since requires one; mark the legacy gap explicitly instead of inventing one.
UPDATE "orders" SET "contactPhone" = '' WHERE "contactPhone" IS NULL;

ALTER TABLE "orders" ALTER COLUMN "contactEmail" SET NOT NULL,
ALTER COLUMN "contactPhone" SET NOT NULL,
ALTER COLUMN "accountId" SET NOT NULL;

-- The relation is now required: an Account with Orders can't be deleted.
ALTER TABLE "orders" DROP CONSTRAINT "orders_accountId_fkey";
ALTER TABLE "orders" ADD CONSTRAINT "orders_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "sign_in_codes" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sign_in_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sign_in_codes_accountId_createdAt_idx" ON "sign_in_codes"("accountId", "createdAt");

-- AddForeignKey
ALTER TABLE "sign_in_codes" ADD CONSTRAINT "sign_in_codes_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
