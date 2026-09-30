-- Fixes from the review of #119, as a new migration: the earlier ones may
-- already be applied to dev and preview databases, so they aren't edited.

-- Order numbers start at ATU-1001. 20260929200000 left an empty table's
-- sequence at setval(1000, false), which hands out 1000 first. Marking
-- the current value as used makes the next one 1001 on an empty table,
-- and MAX + 1 wherever Orders exist (unchanged there).
SELECT setval('"orders_number_seq"', GREATEST((SELECT MAX("number") FROM "orders"), 1000), true);

-- One active Deposit per Order: a second PENDING or RECEIVED Deposit
-- would be counted and summed twice. A retry after a FAILED (or a
-- REFUNDED) Deposit is still allowed. Prisma can't express a partial
-- index, so it lives here only.
CREATE UNIQUE INDEX "payments_one_active_deposit_key" ON "payments"("orderId") WHERE "kind" = 'DEPOSIT' AND "status" IN ('PENDING', 'RECEIVED');

-- Today's Schedule now reads Appointments (appointments_startsAt_idx), so
-- the pickupDate index from 20260930140000 goes. Bundles are deactivated,
-- never deleted, since Orders name them: their foreign key now refuses a
-- delete instead of clearing the Order's bundle.
-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_bundleId_fkey";

-- DropIndex
DROP INDEX "orders_pickupDate_idx";

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "bundles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

