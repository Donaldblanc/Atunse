-- The data model mirrors the admin screens (scratch/01-09 design images):
-- Payments, Calendar Appointments, Services & Pricing, Inventory and
-- Messages, plus order numbers, customer names and item size/colorway.
-- Existing rows are backfilled so every screen reads real data:
-- - order numbers from 1001 in booking order;
-- - one Deposit Payment per Order (RECEIVED if the owner already recorded
--   a MANUAL_PAYMENT_CONFIRMED on any of its Items);
-- - a COLLECTION Appointment for every Local Drop-Off Order;
-- - each Customer Account's name from its latest booking;
-- - the services and bundles tables from src/features/orders/service-catalog.ts.

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('DEPOSIT', 'BALANCE', 'FULL');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ZELLE', 'CASH', 'CARD');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'RECEIVED');

-- CreateEnum
CREATE TYPE "AppointmentKind" AS ENUM ('COLLECTION', 'RETURN');

-- CreateEnum
CREATE TYPE "MessageAuthor" AS ENUM ('CUSTOMER', 'ADMIN');

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "name" TEXT;

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "colorway" TEXT,
ADD COLUMN     "size" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "dropOffFeeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxCents" INTEGER NOT NULL DEFAULT 0;

-- Order numbers: what `number SERIAL` would create, but starting at 1001
-- and handed out to existing Orders in the order they were booked.
CREATE SEQUENCE "orders_number_seq" AS INTEGER START WITH 1001;
ALTER TABLE "orders" ADD COLUMN "number" INTEGER;
UPDATE "orders" AS o
SET "number" = numbered.n
FROM (SELECT "id", 1000 + ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS n FROM "orders") AS numbered
WHERE o."id" = numbered."id";
SELECT setval('"orders_number_seq"', GREATEST((SELECT MAX("number") FROM "orders"), 1000), (SELECT COUNT(*) > 0 FROM "orders"));
ALTER TABLE "orders" ALTER COLUMN "number" SET DEFAULT nextval('"orders_number_seq"');
ALTER TABLE "orders" ALTER COLUMN "number" SET NOT NULL;
ALTER SEQUENCE "orders_number_seq" OWNED BY "orders"."number";

-- Money and stock can't go negative (ADR-0012).
ALTER TABLE "orders" ADD CONSTRAINT "orders_dropOffFeeCents_check" CHECK ("dropOffFeeCents" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_taxCents_check" CHECK ("taxCents" >= 0);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "receivedAt" TIMESTAMP(3),
    "confirmedByAccountId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payments_amountCents_check" CHECK ("amountCents" > 0),
    CONSTRAINT "payments_received_check" CHECK (("status" = 'RECEIVED') = ("receivedAt" IS NOT NULL))
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "AppointmentKind" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "appointments_time_check" CHECK ("endsAt" > "startsAt")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isCleaningTier" BOOLEAN NOT NULL,
    "isAddOn" BOOLEAN NOT NULL,
    "baseCents" INTEGER NOT NULL,
    "isMinimum" BOOLEAN NOT NULL,
    "suedeFee" BOOLEAN NOT NULL,
    "minimumLabel" TEXT,
    "alsoFrom" JSONB,
    "imageKey" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "services_baseCents_check" CHECK ("baseCents" >= 0)
);

-- CreateTable
CREATE TABLE "bundles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "perks" TEXT[],
    "imageKey" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bundles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bundles_priceCents_check" CHECK ("priceCents" >= 0)
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "lowStockAt" INTEGER NOT NULL DEFAULT 0,
    "imageKey" TEXT,
    "supplierId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_items_stock_check" CHECK ("stock" >= 0),
    CONSTRAINT "inventory_items_lowStockAt_check" CHECK ("lowStockAt" >= 0)
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "author" "MessageAuthor" NOT NULL,
    "authorAccountId" TEXT,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- Seed the catalog from src/features/orders/service-catalog.ts (and the
-- descriptions in features/booking/services-data.ts). The catalog-parity
-- integration test fails if the two ever disagree.
INSERT INTO "services" ("id", "name", "description", "isCleaningTier", "isAddOn", "baseCents", "isMinimum", "suedeFee", "minimumLabel", "alsoFrom", "position", "updatedAt") VALUES
    ('standard', 'Standard Clean', 'A deep, thorough clean to keep your sneakers looking and feeling fresh.', true, false, 3000, false, true, NULL, NULL, 0, CURRENT_TIMESTAMP),
    ('premium', 'Premium Clean', 'Our most detailed clean, designed for high-end and heavily worn pairs.', true, false, 5000, false, true, NULL, NULL, 1, CURRENT_TIMESTAMP),
    ('oxidation', 'Oxidation Restoration', 'Treats yellowing and discoloration to brighten oxidized soles.', false, false, 2500, true, false, 'Midsole', '[{"label":"Sole","cents":4000}]'::jsonb, 2, CURRENT_TIMESTAMP),
    ('painting', 'Sneaker Painting & Dyeing', 'Custom color changes, touch-ups, and dye work to refresh, restore, or transform your shoes.', false, false, 4000, true, false, NULL, NULL, 3, CURRENT_TIMESTAMP),
    ('reglue', 'Reglue', 'Professional repair for sole separation, reattaching soles that have come loose.', false, false, 5000, true, false, NULL, NULL, 4, CURRENT_TIMESTAMP),
    ('laces', 'Lace Replacement', 'Fresh new laces to finish the look.', false, true, 1500, false, false, NULL, NULL, 5, CURRENT_TIMESTAMP),
    ('deodorizing', 'Premium Deodorizing Treatment', 'A deeper odor treatment that leaves the inside fresh.', false, true, 1000, false, false, NULL, NULL, 6, CURRENT_TIMESTAMP),
    ('waterproofing', 'Waterproof Seal', 'A seal against rain, stains, and the unexpected.', false, true, 500, false, false, NULL, NULL, 7, CURRENT_TIMESTAMP);

INSERT INTO "bundles" ("id", "name", "priceCents", "perks", "position", "updatedAt") VALUES
    ('revival', 'The Revival Pack', 15000, ARRAY['Premium Clean (all 3 pairs)', 'Suede fee waived', 'Priority turnaround', 'Oxidation touch-up on 1 pair'], 0, CURRENT_TIMESTAMP),
    ('restoration', 'The Restoration Trio', 17500, ARRAY['Premium Clean (all 3 pairs)', 'Suede fee waived', 'Deep sole whitening (all pairs)', 'Oxidation midsole on 1 pair'], 1, CURRENT_TIMESTAMP),
    ('collector', 'The Collector’s Triple', 20000, ARRAY['Premium Clean (all 3 pairs)', 'Suede fee waived', 'Oxidation midsole (2 pairs)', 'Reglue inspection', 'Paint/dye touch-up on 1 pair', 'VIP turnaround (typically 48–72 hours)'], 2, CURRENT_TIMESTAMP);

-- Customer names from each Account's latest booking.
UPDATE "accounts" AS a
SET "name" = latest."contactName"
FROM (
    SELECT DISTINCT ON ("accountId") "accountId", "contactName"
    FROM "orders"
    ORDER BY "accountId", "createdAt" DESC
) AS latest
WHERE a."id" = latest."accountId" AND a."role" = 'CUSTOMER';

-- One Deposit per existing Order. Booking only offers Zelle today.
INSERT INTO "payments" ("id", "orderId", "kind", "method", "amountCents", "status", "receivedAt", "confirmedByAccountId", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    o."id",
    'DEPOSIT',
    'ZELLE',
    o."depositCents",
    CASE WHEN confirmed."createdAt" IS NULL THEN 'PENDING' ELSE 'RECEIVED' END::"PaymentStatus",
    confirmed."createdAt",
    confirmed."actorAccountId",
    o."createdAt",
    CURRENT_TIMESTAMP
FROM "orders" AS o
LEFT JOIN LATERAL (
    SELECT e."createdAt", e."actorAccountId"
    FROM "item_audit_entries" AS e
    JOIN "items" AS i ON i."id" = e."itemId"
    WHERE i."orderId" = o."id" AND e."action" = 'MANUAL_PAYMENT_CONFIRMED'
    ORDER BY e."createdAt"
    LIMIT 1
) AS confirmed ON TRUE
WHERE o."depositCents" > 0;

-- A COLLECTION Appointment for every Local Drop-Off Order, from its booked
-- date and slot ("4:30 PM – 5:00 PM", New York time), stored as UTC.
INSERT INTO "appointments" ("id", "orderId", "kind", "startsAt", "endsAt", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    o."id",
    'COLLECTION',
    (to_char(o."pickupDate", 'YYYY-MM-DD') || ' ' || split_part(o."pickupSlot", ' – ', 1))::timestamp AT TIME ZONE 'America/New_York' AT TIME ZONE 'UTC',
    (to_char(o."pickupDate", 'YYYY-MM-DD') || ' ' || split_part(o."pickupSlot", ' – ', 2))::timestamp AT TIME ZONE 'America/New_York' AT TIME ZONE 'UTC',
    o."createdAt",
    CURRENT_TIMESTAMP
FROM "orders" AS o
WHERE o."fulfillmentMethod" = 'PICKUP'
  AND o."pickupDate" IS NOT NULL
  AND o."pickupSlot" ~ '^[0-9]{1,2}:[0-9]{2} [AP]M – [0-9]{1,2}:[0-9]{2} [AP]M$';

-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "payments_status_kind_idx" ON "payments"("status", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "payments_orderId_idempotencyKey_key" ON "payments"("orderId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "appointments_startsAt_idx" ON "appointments"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_orderId_kind_key" ON "appointments"("orderId", "kind");

-- CreateIndex
CREATE INDEX "inventory_items_category_idx" ON "inventory_items"("category");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_orderId_key" ON "conversations"("orderId");

-- CreateIndex
CREATE INDEX "conversations_lastMessageAt_idx" ON "conversations"("lastMessageAt");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "bundles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

