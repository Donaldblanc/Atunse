-- Completes the data model for every admin screen in the newer design set
-- (scratch/*.jpeg), on top of 20260929200000_admin_screens_data_model:
-- Reviews, Settings (business profile, operating hours), the bell
-- (Notification), customer/order Notes, stock history, image galleries,
-- message attachments and channels, Conversations not tied to an Order,
-- Apple Pay and failed/refunded Payments, Appointment status and staff,
-- Service categories and per-Service suede fees, and item condition.
-- Existing rows are backfilled; nothing is lost.

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('CLEANING', 'RESTORATION', 'CUSTOM_WORK', 'ADDITIONAL');

-- CreateEnum
CREATE TYPE "StockMovementReason" AS ENUM ('RESTOCK', 'USED', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('NEW_BOOKING', 'CUSTOMER_MESSAGE', 'PAYMENT_RECEIVED', 'LOW_STOCK', 'NEW_REVIEW');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'APPLE_PAY';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'FAILED';
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_orderId_fkey";

-- DropIndex
DROP INDEX "conversations_orderId_key";

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "assignedToAccountId" TEXT,
ADD COLUMN     "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED';

-- AlterTable
ALTER TABLE "bundles" ADD COLUMN     "internalNotes" TEXT;

-- A Conversation belongs to a customer, and only optionally to an Order:
-- existing ones take their Order's Account.
ALTER TABLE "conversations" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "subject" TEXT,
ALTER COLUMN "orderId" DROP NOT NULL;
UPDATE "conversations" AS c SET "accountId" = o."accountId" FROM "orders" AS o WHERE o."id" = c."orderId";
ALTER TABLE "conversations" ALTER COLUMN "accountId" SET NOT NULL;

-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "sellingPriceCents" INTEGER,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "unitCostCents" INTEGER;

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "condition" TEXT;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "channel" "MessageChannel" NOT NULL DEFAULT 'IN_APP';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "reviewRequestedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3);

-- Services get a category (Services & Pricing) and their own suede fee
-- amount instead of a flag: the flat $10 Suede Fee where the flag was set.
ALTER TABLE "services" ADD COLUMN     "category" "ServiceCategory",
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "suedeFeeCents" INTEGER NOT NULL DEFAULT 0;
UPDATE "services" SET "category" = CASE
    WHEN "isAddOn" THEN 'ADDITIONAL'
    WHEN "isCleaningTier" THEN 'CLEANING'
    WHEN "id" = 'painting' THEN 'CUSTOM_WORK'
    ELSE 'RESTORATION'
END::"ServiceCategory";
ALTER TABLE "services" ALTER COLUMN "category" SET NOT NULL;
UPDATE "services" SET "suedeFeeCents" = 1000 WHERE "suedeFee";
ALTER TABLE "services" DROP COLUMN "suedeFee";

-- CreateTable
CREATE TABLE "service_images" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "service_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_images" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "bundle_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_images" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "inventory_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "change" INTEGER NOT NULL,
    "reason" "StockMovementReason" NOT NULL,
    "note" TEXT,
    "orderId" TEXT,
    "actorAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attachments" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "orderId" TEXT,
    "authorAccountId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "orderId" TEXT,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "publishedAt" TIMESTAMP(3),
    "reply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "repliedByAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_photos" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "review_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "recipientAccountId" TEXT,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "orderId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "businessName" TEXT NOT NULL,
    "tagline" TEXT,
    "ownerName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "websiteUrl" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "timeZone" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "logoKey" TEXT,
    "allowLocalDropOff" BOOLEAN NOT NULL DEFAULT true,
    "allowMailIn" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operating_hours" (
    "weekday" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL,
    "opensAt" INTEGER NOT NULL,
    "closesAt" INTEGER NOT NULL,

    CONSTRAINT "operating_hours_pkey" PRIMARY KEY ("weekday")
);

-- Single images move into the new galleries before their columns go.
INSERT INTO "service_images" ("id", "serviceId", "key", "position")
SELECT gen_random_uuid()::text, "id", "imageKey", 0 FROM "services" WHERE "imageKey" IS NOT NULL;
INSERT INTO "bundle_images" ("id", "bundleId", "key", "position")
SELECT gen_random_uuid()::text, "id", "imageKey", 0 FROM "bundles" WHERE "imageKey" IS NOT NULL;
INSERT INTO "inventory_images" ("id", "itemId", "key", "position")
SELECT gen_random_uuid()::text, "id", "imageKey", 0 FROM "inventory_items" WHERE "imageKey" IS NOT NULL;
ALTER TABLE "services" DROP COLUMN "imageKey";
ALTER TABLE "bundles" DROP COLUMN "imageKey";
ALTER TABLE "inventory_items" DROP COLUMN "imageKey";

-- Rules the database enforces itself (ADR-0012). Statuses are compared as
-- text: Postgres won't use an enum value added in this same migration.
ALTER TABLE "payments" DROP CONSTRAINT "payments_received_check";
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_check" CHECK (("receivedAt" IS NOT NULL) = ("status"::text IN ('RECEIVED', 'REFUNDED')));
ALTER TABLE "payments" ADD CONSTRAINT "payments_refunded_check" CHECK (("refundedAt" IS NOT NULL) = ("status"::text = 'REFUNDED'));
ALTER TABLE "services" ADD CONSTRAINT "services_suedeFeeCents_check" CHECK ("suedeFeeCents" >= 0);
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_prices_check" CHECK (COALESCE("unitCostCents", 0) >= 0 AND COALESCE("sellingPriceCents", 0) >= 0);
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_change_check" CHECK ("change" <> 0);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_single_row_check" CHECK ("id" = 1);
ALTER TABLE "operating_hours" ADD CONSTRAINT "operating_hours_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6);
ALTER TABLE "operating_hours" ADD CONSTRAINT "operating_hours_times_check" CHECK ("opensAt" >= 0 AND "closesAt" <= 1440 AND "opensAt" < "closesAt");

-- Settings start from what the site does today: the business details it
-- shows, New York time and USD, both Fulfillment Methods on, and Local
-- Drop-Off collections 8:00 AM-10:00 PM every day (pickup-window.ts).
INSERT INTO "business_settings" ("id", "businessName", "tagline", "ownerName", "timeZone", "currency", "updatedAt")
VALUES (1, 'Atunṣe', 'Restore more than sneakers.', 'Adedeji Lawal', 'America/New_York', 'USD', CURRENT_TIMESTAMP);
INSERT INTO "operating_hours" ("weekday", "isOpen", "opensAt", "closesAt")
SELECT weekday, true, 480, 1320 FROM generate_series(0, 6) AS weekday;

-- CreateIndex
CREATE UNIQUE INDEX "service_images_key_key" ON "service_images"("key");

-- CreateIndex
CREATE INDEX "service_images_serviceId_idx" ON "service_images"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "bundle_images_key_key" ON "bundle_images"("key");

-- CreateIndex
CREATE INDEX "bundle_images_bundleId_idx" ON "bundle_images"("bundleId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_images_key_key" ON "inventory_images"("key");

-- CreateIndex
CREATE INDEX "inventory_images_itemId_idx" ON "inventory_images"("itemId");

-- CreateIndex
CREATE INDEX "stock_movements_itemId_createdAt_idx" ON "stock_movements"("itemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "message_attachments_key_key" ON "message_attachments"("key");

-- CreateIndex
CREATE INDEX "message_attachments_messageId_idx" ON "message_attachments"("messageId");

-- CreateIndex
CREATE INDEX "notes_accountId_createdAt_idx" ON "notes"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "notes_orderId_idx" ON "notes"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_orderId_key" ON "reviews"("orderId");

-- CreateIndex
CREATE INDEX "reviews_status_createdAt_idx" ON "reviews"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "review_photos_key_key" ON "review_photos"("key");

-- CreateIndex
CREATE INDEX "review_photos_reviewId_idx" ON "review_photos"("reviewId");

-- CreateIndex
CREATE INDEX "notifications_recipientAccountId_readAt_createdAt_idx" ON "notifications"("recipientAccountId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "conversations_accountId_idx" ON "conversations"("accountId");

-- CreateIndex
CREATE INDEX "conversations_orderId_idx" ON "conversations"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_sku_key" ON "inventory_items"("sku");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_images" ADD CONSTRAINT "service_images_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_images" ADD CONSTRAINT "bundle_images_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "bundles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_images" ADD CONSTRAINT "inventory_images_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_photos" ADD CONSTRAINT "review_photos_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

