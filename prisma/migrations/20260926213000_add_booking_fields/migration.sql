-- Booking fields for /booking's single-pair submission.
-- Orders created before this migration (Phase 1 API smoke tests only) get
-- placeholder values through temporary defaults, which are dropped at the
-- end so new rows must always supply real values.

-- CreateEnum
CREATE TYPE "FulfillmentMethod" AS ENUM ('PICKUP', 'MAIL_IN');

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "estimateCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "material" TEXT,
ADD COLUMN     "serviceIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "addressLine1" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "city" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "contactName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "depositCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "estimateCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "estimateIsMinimum" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fulfillmentMethod" "FulfillmentMethod" NOT NULL DEFAULT 'MAIL_IN',
ADD COLUMN     "mailInDate" DATE,
ADD COLUMN     "pickupDate" DATE,
ADD COLUMN     "pickupSlot" TEXT,
ADD COLUMN     "rush" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "state" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "submissionKey" TEXT,
ADD COLUMN     "zip" TEXT NOT NULL DEFAULT '';

-- Drop the backfill-only defaults.
ALTER TABLE "items" ALTER COLUMN "estimateCents" DROP DEFAULT,
ALTER COLUMN "serviceIds" DROP DEFAULT;

ALTER TABLE "orders" ALTER COLUMN "addressLine1" DROP DEFAULT,
ALTER COLUMN "city" DROP DEFAULT,
ALTER COLUMN "contactName" DROP DEFAULT,
ALTER COLUMN "depositCents" DROP DEFAULT,
ALTER COLUMN "estimateCents" DROP DEFAULT,
ALTER COLUMN "estimateIsMinimum" DROP DEFAULT,
ALTER COLUMN "fulfillmentMethod" DROP DEFAULT,
ALTER COLUMN "state" DROP DEFAULT,
ALTER COLUMN "zip" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_submissionKey_key" ON "orders"("submissionKey");
