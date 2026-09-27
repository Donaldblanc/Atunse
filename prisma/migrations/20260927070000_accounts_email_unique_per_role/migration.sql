-- Repairs databases that applied the first version of
-- 20260927040000_customer_accounts_and_sign_in_codes (commit f7969ac).
-- That migration was edited afterwards, and `prisma migrate deploy` skips
-- migrations a database has already applied, so those databases never got
-- the edit. A no-op on databases that ran the current version.

-- 1. Admin and Customer Accounts are separate identities (ADR-0014): an
--    email is unique per role, not globally.
DROP INDEX IF EXISTS "accounts_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_email_role_key" ON "accounts"("email", "role");

-- 2. The old version could attach an Order to an Admin Account (its
--    backfill, and bookings made with an admin's email). Orders only ever
--    belong to Customer Accounts: give each such email its Customer Account
--    and move the Orders there.
INSERT INTO "accounts" ("id", "role", "email", "phone", "createdAt")
SELECT
  gen_random_uuid()::text,
  'CUSTOMER',
  a."email",
  (array_agg(o."contactPhone" ORDER BY o."createdAt") FILTER (WHERE o."contactPhone" <> ''))[1],
  min(o."createdAt")
FROM "orders" o
JOIN "accounts" a ON a."id" = o."accountId"
WHERE a."role" = 'ADMIN'
GROUP BY a."email"
ON CONFLICT ("email", "role") DO NOTHING;

UPDATE "orders" o
SET "accountId" = c."id"
FROM "accounts" a, "accounts" c
WHERE a."id" = o."accountId"
  AND a."role" = 'ADMIN'
  AND c."email" = a."email"
  AND c."role" = 'CUSTOMER';
